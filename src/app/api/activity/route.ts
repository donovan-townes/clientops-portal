import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewActivityLog } from "@/lib/rbac";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  ACTIVE_WORKSPACE_COOKIE_OPTIONS,
  getActiveWorkspaceIdFromCookieHeader,
} from "@/lib/workspace-context";
import { resolveActiveWorkspaceForUser } from "@/lib/workspaces";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const candidateWorkspaceId = getActiveWorkspaceIdFromCookieHeader(
    request.headers.get("cookie"),
  );

  const context = await resolveActiveWorkspaceForUser(
    session.user.id,
    candidateWorkspaceId,
  );

  if (!context.activeWorkspace) {
    return NextResponse.json(
      { error: "No active workspace. Create a workspace first." },
      { status: 400 },
    );
  }

  const activeWorkspaceId = context.activeWorkspace.id;

  const membership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: activeWorkspaceId,
        userId: session.user.id,
      },
    },
    select: { role: true },
  });

  if (!membership || !canViewActivityLog(membership.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions to view activity log." },
      { status: 403 },
    );
  }

  const rawEvents = await prisma.activityEvent.findMany({
    where: { workspaceId: activeWorkspaceId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { email: true } } },
  });

  const events = rawEvents.map((e: (typeof rawEvents)[number]) => ({
    id: e.id,
    workspaceId: e.workspaceId,
    actorUserId: e.actorUserId,
    actorEmail: e.actor.email,
    type: e.type,
    payloadJson: e.payloadJson,
    createdAt: e.createdAt.toISOString(),
  }));

  const response = NextResponse.json({ events, activeWorkspaceId });

  if (context.shouldPersistActiveWorkspace) {
    response.cookies.set(
      ACTIVE_WORKSPACE_COOKIE_NAME,
      activeWorkspaceId,
      ACTIVE_WORKSPACE_COOKIE_OPTIONS,
    );
  }

  return response;
}
