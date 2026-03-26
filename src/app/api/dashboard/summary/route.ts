import { TaskStatus } from "@prisma/client";
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
      { error: "Insufficient permissions to view dashboard summary." },
      { status: 403 },
    );
  }

  const [
    tasksTotal,
    tasksTodo,
    tasksInProgress,
    tasksDone,
    deliverablesTotal,
    membersTotal,
    activityEventsTotal,
  ] = await Promise.all([
    prisma.task.count({ where: { workspaceId: activeWorkspaceId } }),
    prisma.task.count({
      where: { workspaceId: activeWorkspaceId, status: TaskStatus.TODO },
    }),
    prisma.task.count({
      where: {
        workspaceId: activeWorkspaceId,
        status: TaskStatus.IN_PROGRESS,
      },
    }),
    prisma.task.count({
      where: { workspaceId: activeWorkspaceId, status: TaskStatus.DONE },
    }),
    prisma.deliverable.count({ where: { workspaceId: activeWorkspaceId } }),
    prisma.membership.count({ where: { workspaceId: activeWorkspaceId } }),
    prisma.activityEvent.count({ where: { workspaceId: activeWorkspaceId } }),
  ]);

  const response = NextResponse.json({
    activeWorkspaceId,
    summary: {
      tasksTotal,
      tasksTodo,
      tasksInProgress,
      tasksDone,
      deliverablesTotal,
      membersTotal,
      activityEventsTotal,
    },
  });

  if (context.shouldPersistActiveWorkspace) {
    response.cookies.set(
      ACTIVE_WORKSPACE_COOKIE_NAME,
      activeWorkspaceId,
      ACTIVE_WORKSPACE_COOKIE_OPTIONS,
    );
  }

  return response;
}
