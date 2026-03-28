import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { logActivityEvent } from "@/lib/activity-events";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  ACTIVE_WORKSPACE_COOKIE_OPTIONS,
  getActiveWorkspaceIdFromCookieHeader,
} from "@/lib/workspace-context";
import { canDeleteTask, canEditTask } from "@/lib/rbac";
import { resolveActiveWorkspaceForUser } from "@/lib/workspaces";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

const TASK_STATUSES = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
} as const satisfies Record<TaskStatus, TaskStatus>;

type RouteContext = {
  params: Promise<{ taskId: string }> | { taskId: string };
};

type ResolvedRouteContext =
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

async function resolveContext(request: Request): Promise<ResolvedRouteContext> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
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

export async function PATCH(request: Request, context: RouteContext) {
  const resolved = await resolveContext(request);

  if (!resolved.ok) {
    return resolved.response;
  }

  const { taskId } = await Promise.resolve(context.params);

  const actorMembership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: resolved.activeWorkspaceId,
        userId: resolved.session.user.id,
      },
    },
    select: { role: true },
  });

  if (!actorMembership || !canEditTask(actorMembership.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions to edit tasks." },
      { status: 403 },
    );
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      workspaceId: resolved.activeWorkspaceId,
    },
    select: {
      id: true,
      workspaceId: true,
      status: true,
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const { title, description, status, assigneeUserId, dueAt } =
    (await request.json()) as {
      title?: string;
      description?: string;
      status?: string;
      assigneeUserId?: string;
      dueAt?: string | null;
    };

  const updateData: {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    assigneeUserId?: string | null;
    dueAt?: Date | null;
  } = {};

  if (title !== undefined) {
    if (!title.trim()) {
      return NextResponse.json(
        { error: "Task title is required" },
        { status: 400 },
      );
    }

    updateData.title = title.trim();
  }

  if (description !== undefined) {
    updateData.description = description.trim() ? description.trim() : null;
  }

  if (status !== undefined) {
    if (!Object.values(TASK_STATUSES).includes(status as TaskStatus)) {
      return NextResponse.json(
        { error: "Task status is invalid" },
        { status: 400 },
      );
    }

    const nextStatus = status as TaskStatus;

    updateData.status = nextStatus;
  }

  if (assigneeUserId !== undefined) {
    updateData.assigneeUserId = assigneeUserId.trim() ? assigneeUserId.trim() : null;
  }

  if (dueAt !== undefined) {
    if (dueAt === null) {
      updateData.dueAt = null;
    } else if (dueAt.trim()) {
      const parsedDueAt = new Date(dueAt);

      if (Number.isNaN(parsedDueAt.getTime())) {
        return NextResponse.json(
          { error: "Task due date must be a valid ISO date-time" },
          { status: 400 },
        );
      }

      updateData.dueAt = parsedDueAt;
    } else {
      updateData.dueAt = null;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No task fields provided for update" },
      { status: 400 },
    );
  }

  const updatedTask = await prisma.task.update({
    where: { id: task.id },
    data: updateData,
  });

  if (updateData.status && updateData.status !== task.status) {
    await logActivityEvent({
      workspaceId: resolved.activeWorkspaceId,
      actorUserId: resolved.session.user.id,
      type: "TASK_STATUS_CHANGED",
      payloadJson: {
        taskId: task.id,
        fromStatus: task.status,
        toStatus: updateData.status,
      },
    });
  } else {
    await logActivityEvent({
      workspaceId: resolved.activeWorkspaceId,
      actorUserId: resolved.session.user.id,
      type: "TASK_UPDATED",
      payloadJson: {
        taskId: task.id,
      },
    });
  }

  const response = NextResponse.json({
    task: updatedTask,
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

  const { taskId } = await Promise.resolve(context.params);

  const actorMembership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: resolved.activeWorkspaceId,
        userId: resolved.session.user.id,
      },
    },
    select: { role: true },
  });

  if (!actorMembership || !canDeleteTask(actorMembership.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions to delete tasks." },
      { status: 403 },
    );
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      workspaceId: resolved.activeWorkspaceId,
    },
    select: {
      id: true,
      workspaceId: true,
      status: true,
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.task.delete({
    where: { id: task.id },
  });

  await logActivityEvent({
    workspaceId: resolved.activeWorkspaceId,
    actorUserId: resolved.session.user.id,
    type: "TASK_DELETED",
    payloadJson: {
      taskId: task.id,
      status: task.status,
    },
  });

  const response = NextResponse.json({
    deletedTaskId: task.id,
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
