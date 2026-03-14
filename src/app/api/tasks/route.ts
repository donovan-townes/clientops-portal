import { TaskStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { logActivityEvent } from "@/lib/activity-events";
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

const TASK_PAGE_SIZE_DEFAULT = 20;
const TASK_PAGE_SIZE_MAX = 100;

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    return Number.NaN;
  }

  return parsed;
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

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const sort = url.searchParams.get("sort") ?? "newest";
  const page = parsePositiveInteger(url.searchParams.get("page"), 1);
  const pageSize = parsePositiveInteger(
    url.searchParams.get("pageSize"),
    TASK_PAGE_SIZE_DEFAULT,
  );

  if (
    statusFilter &&
    !Object.values(TaskStatus).includes(statusFilter as TaskStatus)
  ) {
    return NextResponse.json(
      { error: "Task status filter is invalid" },
      { status: 400 },
    );
  }

  if (
    !Number.isInteger(page) ||
    !Number.isInteger(pageSize) ||
    page < 1 ||
    pageSize < 1 ||
    pageSize > TASK_PAGE_SIZE_MAX
  ) {
    return NextResponse.json(
      {
        error:
          "Task pagination params are invalid. page must be >= 1 and pageSize must be between 1 and 100",
      },
      { status: 400 },
    );
  }

  const where = {
    workspaceId: context.activeWorkspace.id,
    ...(statusFilter ? { status: statusFilter as TaskStatus } : {}),
  };

  const orderBy = {
    createdAt: sort === "oldest" ? ("asc" as const) : ("desc" as const),
  };

  const skip = (page - 1) * pageSize;
  const total = await prisma.task.count({ where });

  const tasks = await prisma.task.findMany({
    where,
    orderBy,
    skip,
    take: pageSize,
  });

  const response = NextResponse.json({
    tasks,
    activeWorkspaceId: context.activeWorkspace.id,
    pagination: {
      page,
      pageSize,
      total,
    },
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

  const { title, description, assigneeUserId, dueAt } =
    (await request.json()) as {
      title?: string;
      description?: string;
      assigneeUserId?: string;
      dueAt?: string;
    };

  if (!title?.trim()) {
    return NextResponse.json(
      { error: "Task title is required" },
      { status: 400 },
    );
  }

  let parsedDueAt: Date | null = null;

  if (dueAt?.trim()) {
    parsedDueAt = new Date(dueAt);

    if (Number.isNaN(parsedDueAt.getTime())) {
      return NextResponse.json(
        { error: "Task due date must be a valid ISO date-time" },
        { status: 400 },
      );
    }
  }

  const task = await prisma.task.create({
    data: {
      workspaceId: context.activeWorkspace.id,
      title: title.trim(),
      description: description?.trim() ? description.trim() : null,
      assigneeUserId: assigneeUserId?.trim() ? assigneeUserId.trim() : null,
      dueAt: parsedDueAt,
    },
  });

  await logActivityEvent({
    workspaceId: context.activeWorkspace.id,
    actorUserId: session.user.id,
    type: "TASK_CREATED",
    payloadJson: {
      taskId: task.id,
      title: task.title,
      status: task.status,
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
