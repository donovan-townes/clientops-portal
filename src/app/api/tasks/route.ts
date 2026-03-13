import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  ACTIVE_WORKSPACE_COOKIE_OPTIONS,
  getActiveWorkspaceIdFromCookieHeader,
} from "@/lib/workspace-context";
import { canCreateTask, canViewTasksAndFiles } from "@/lib/rbac";
import { resolveActiveWorkspaceForUser } from "@/lib/workspaces";

function getContextErrorResponse() {
  return NextResponse.json(
    { error: "No active workspace. Create a workspace first." },
    { status: 400 },
  );
}

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
    return getContextErrorResponse();
  }

  const actorMembership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: context.activeWorkspace.id,
        userId: session.user.id,
      },
    },
    select: { role: true },
  });

  if (!actorMembership || !canViewTasksAndFiles(actorMembership.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions to view tasks." },
      { status: 403 },
    );
  }

  const tasks = await prisma.task.findMany({
    where: {
      workspaceId: context.activeWorkspace.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const response = NextResponse.json({
    tasks,
    activeWorkspaceId: context.activeWorkspace.id,
  });

  if (context.shouldPersistActiveWorkspace) {
    response.cookies.set(
      ACTIVE_WORKSPACE_COOKIE_NAME,
      context.activeWorkspace.id,
      ACTIVE_WORKSPACE_COOKIE_OPTIONS,
    );
  }

  return response;
}

export async function POST(request: Request) {
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
    return getContextErrorResponse();
  }

  const actorMembership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: context.activeWorkspace.id,
        userId: session.user.id,
      },
    },
    select: { role: true },
  });

  if (!actorMembership || !canCreateTask(actorMembership.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions to create tasks." },
      { status: 403 },
    );
  }

  const { title, description } = (await request.json()) as {
    title?: string;
    description?: string;
  };

  if (!title?.trim()) {
    return NextResponse.json(
      { error: "Task title is required" },
      { status: 400 },
    );
  }

  const task = await prisma.task.create({
    data: {
      workspaceId: context.activeWorkspace.id,
      title: title.trim(),
      description: description?.trim() ? description.trim() : null,
    },
  });

  const response = NextResponse.json({
    task,
    activeWorkspaceId: context.activeWorkspace.id,
  });

  if (context.shouldPersistActiveWorkspace) {
    response.cookies.set(
      ACTIVE_WORKSPACE_COOKIE_NAME,
      context.activeWorkspace.id,
      ACTIVE_WORKSPACE_COOKIE_OPTIONS,
    );
  }

  return response;
}
