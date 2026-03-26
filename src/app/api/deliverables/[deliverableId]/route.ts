import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { logActivityEvent } from "@/lib/activity-events";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDeleteFile, canViewTasksAndFiles } from "@/lib/rbac";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  ACTIVE_WORKSPACE_COOKIE_OPTIONS,
  getActiveWorkspaceIdFromCookieHeader,
} from "@/lib/workspace-context";
import { resolveActiveWorkspaceForUser } from "@/lib/workspaces";

type RouteContext = {
  params:
    | Promise<{
        deliverableId: string;
      }>
    | {
        deliverableId: string;
      };
};

type ResolvedContext =
  | {
      ok: false;
      response: NextResponse<{ error: string }>;
    }
  | {
      ok: true;
      session: {
        user: {
          id: string;
        };
      };
      activeWorkspaceId: string;
      shouldPersistActiveWorkspace: boolean;
    };

function getContextErrorResponse() {
  return NextResponse.json(
    { error: "No active workspace. Create a workspace first." },
    { status: 400 },
  );
}

async function resolveContext(request: Request): Promise<ResolvedContext> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      ),
    };
  }

  const candidateWorkspaceId = getActiveWorkspaceIdFromCookieHeader(
    request.headers.get("cookie"),
  );

  const context = await resolveActiveWorkspaceForUser(
    session.user.id,
    candidateWorkspaceId,
  );

  if (!context.activeWorkspace) {
    return {
      ok: false,
      response: getContextErrorResponse(),
    };
  }

  return {
    ok: true,
    session,
    activeWorkspaceId: context.activeWorkspace.id,
    shouldPersistActiveWorkspace: context.shouldPersistActiveWorkspace,
  };
}

export async function GET(request: Request, context: RouteContext) {
  const resolved = await resolveContext(request);

  if (!resolved.ok) {
    return resolved.response;
  }

  const { deliverableId } = await Promise.resolve(context.params);

  const actorMembership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: resolved.activeWorkspaceId,
        userId: resolved.session.user.id,
      },
    },
    select: { role: true },
  });

  if (!actorMembership || !canViewTasksAndFiles(actorMembership.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions to view deliverables." },
      { status: 403 },
    );
  }

  const deliverable = await prisma.deliverable.findFirst({
    where: {
      id: deliverableId,
      workspaceId: resolved.activeWorkspaceId,
    },
  });

  if (!deliverable) {
    return NextResponse.json(
      { error: "Deliverable not found" },
      { status: 404 },
    );
  }

  const response = NextResponse.json({
    deliverable,
    activeWorkspaceId: resolved.activeWorkspaceId,
  });

  if (resolved.shouldPersistActiveWorkspace) {
    response.cookies.set(
      ACTIVE_WORKSPACE_COOKIE_NAME,
      resolved.activeWorkspaceId,
      ACTIVE_WORKSPACE_COOKIE_OPTIONS,
    );
  }

  return response;
}

export async function DELETE(request: Request, context: RouteContext) {
  const resolved = await resolveContext(request);

  if (!resolved.ok) {
    return resolved.response;
  }

  const { deliverableId } = await Promise.resolve(context.params);

  const actorMembership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: resolved.activeWorkspaceId,
        userId: resolved.session.user.id,
      },
    },
    select: { role: true },
  });

  if (!actorMembership || !canDeleteFile(actorMembership.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions to delete deliverables." },
      { status: 403 },
    );
  }

  const deliverable = await prisma.deliverable.findFirst({
    where: {
      id: deliverableId,
      workspaceId: resolved.activeWorkspaceId,
    },
  });

  if (!deliverable) {
    return NextResponse.json(
      { error: "Deliverable not found" },
      { status: 404 },
    );
  }

  await prisma.deliverable.delete({
    where: { id: deliverable.id },
  });

  await logActivityEvent({
    workspaceId: resolved.activeWorkspaceId,
    actorUserId: resolved.session.user.id,
    type: "FILE_DELETED",
    payloadJson: {
      deliverableId: deliverable.id,
      filename: deliverable.filename,
      taskId: deliverable.taskId,
    },
  });

  const response = NextResponse.json({
    deletedDeliverableId: deliverable.id,
    activeWorkspaceId: resolved.activeWorkspaceId,
  });

  if (resolved.shouldPersistActiveWorkspace) {
    response.cookies.set(
      ACTIVE_WORKSPACE_COOKIE_NAME,
      resolved.activeWorkspaceId,
      ACTIVE_WORKSPACE_COOKIE_OPTIONS,
    );
  }

  return response;
}
