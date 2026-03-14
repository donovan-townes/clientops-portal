import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const resolveActiveWorkspaceForUserMock = vi.fn();

const prismaMock = {
  membership: {
    findUnique: vi.fn(),
  },
  activityEvent: {
    create: vi.fn(),
  },
  task: {
    count: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/workspaces", () => ({
  resolveActiveWorkspaceForUser: resolveActiveWorkspaceForUserMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("/api/tasks", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXTAUTH_SECRET = "test-secret";
    getServerSessionMock.mockReset();
    resolveActiveWorkspaceForUserMock.mockReset();
    prismaMock.membership.findUnique.mockReset();
    prismaMock.activityEvent.create.mockReset();
    prismaMock.task.count.mockReset();
    prismaMock.task.findMany.mockReset();
    prismaMock.task.create.mockReset();
  });

  it("returns 401 from GET when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { GET } = await import("@/app/api/tasks/route");
    const response = await GET(new Request("http://localhost:3000/api/tasks"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthenticated");
  });

  it("returns 400 when no active workspace can be resolved", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [],
      activeWorkspace: null,
      shouldPersistActiveWorkspace: false,
    });

    const { GET } = await import("@/app/api/tasks/route");
    const response = await GET(new Request("http://localhost:3000/api/tasks"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("No active workspace. Create a workspace first.");
  });

  it("returns tasks scoped to the active workspace", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-2", name: "Demo Workspace" }],
      activeWorkspace: { id: "workspace-2", name: "Demo Workspace" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.task.count.mockResolvedValue(1);
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: "task-1",
        title: "Task One",
        workspaceId: "workspace-2",
        status: "TODO",
      },
    ]);

    const { GET } = await import("@/app/api/tasks/route");
    const response = await GET(new Request("http://localhost:3000/api/tasks"));
    const body = (await response.json()) as {
      activeWorkspaceId: string;
      tasks: Array<{ id: string; workspaceId: string }>;
      pagination: { page: number; pageSize: number; total: number };
    };

    expect(response.status).toBe(200);
    expect(body.activeWorkspaceId).toBe("workspace-2");
    expect(body.tasks).toHaveLength(1);
    expect(prismaMock.membership.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: "workspace-2",
          userId: "user-1",
        },
      },
      select: { role: true },
    });
    expect(prismaMock.task.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-2" },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 20,
    });
    expect(body.pagination).toEqual({ page: 1, pageSize: 20, total: 1 });
  });

  it("applies status filter, oldest sort, and pagination to GET /api/tasks", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-2", name: "Demo Workspace" }],
      activeWorkspace: { id: "workspace-2", name: "Demo Workspace" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "ADMIN" });
    prismaMock.task.count.mockResolvedValue(5);
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: "task-5",
        title: "Older task",
        workspaceId: "workspace-2",
        status: "IN_PROGRESS",
      },
    ]);

    const { GET } = await import("@/app/api/tasks/route");
    const response = await GET(
      new Request(
        "http://localhost:3000/api/tasks?status=IN_PROGRESS&sort=oldest&page=2&pageSize=5",
      ),
    );
    const body = (await response.json()) as {
      activeWorkspaceId: string;
      tasks: Array<{ id: string; status: string }>;
      pagination: { page: number; pageSize: number; total: number };
    };

    expect(response.status).toBe(200);
    expect(prismaMock.task.count).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-2",
        status: "IN_PROGRESS",
      },
    });
    expect(prismaMock.task.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-2",
        status: "IN_PROGRESS",
      },
      orderBy: { createdAt: "asc" },
      skip: 5,
      take: 5,
    });
    expect(body.pagination).toEqual({ page: 2, pageSize: 5, total: 5 });
    expect(body.tasks[0].status).toBe("IN_PROGRESS");
  });

  it("returns 400 from GET when status filter is invalid", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-2", name: "Demo Workspace" }],
      activeWorkspace: { id: "workspace-2", name: "Demo Workspace" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "OWNER" });

    const { GET } = await import("@/app/api/tasks/route");
    const response = await GET(
      new Request("http://localhost:3000/api/tasks?status=INVALID"),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Task status filter is invalid");
    expect(prismaMock.task.findMany).not.toHaveBeenCalled();
  });

  it("returns 400 from GET when pagination params are invalid", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-2", name: "Demo Workspace" }],
      activeWorkspace: { id: "workspace-2", name: "Demo Workspace" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "OWNER" });

    const { GET } = await import("@/app/api/tasks/route");
    const response = await GET(
      new Request("http://localhost:3000/api/tasks?page=0&pageSize=500"),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe(
      "Task pagination params are invalid. page must be >= 1 and pageSize must be between 1 and 100",
    );
    expect(prismaMock.task.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 from GET when caller has no workspace membership", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-2", name: "Demo Workspace" }],
      activeWorkspace: { id: "workspace-2", name: "Demo Workspace" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/tasks/route");
    const response = await GET(new Request("http://localhost:3000/api/tasks"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Insufficient permissions to view tasks.");
    expect(prismaMock.task.findMany).not.toHaveBeenCalled();
  });

  it("creates a task under the resolved active workspace", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-3", name: "Client Workspace" }],
      activeWorkspace: { id: "workspace-3", name: "Client Workspace" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({
      role: "CONTRIBUTOR",
    });
    prismaMock.task.create.mockResolvedValue({
      id: "task-2",
      title: "Create first board",
      description: "Draft first board structure",
      status: "TODO",
      assigneeUserId: "user-2",
      dueAt: "2026-03-20T12:00:00.000Z",
      workspaceId: "workspace-3",
    });

    const { POST } = await import("@/app/api/tasks/route");
    const response = await POST(
      new Request("http://localhost:3000/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Create first board",
          description: "  Draft first board structure  ",
          assigneeUserId: "user-2",
          dueAt: "2026-03-20T12:00:00.000Z",
        }),
      }),
    );

    const body = (await response.json()) as {
      task: {
        id: string;
        workspaceId: string;
        status: string;
        assigneeUserId: string | null;
        dueAt: string | null;
      };
      activeWorkspaceId: string;
    };

    expect(response.status).toBe(200);
    expect(body.activeWorkspaceId).toBe("workspace-3");
    expect(prismaMock.membership.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: "workspace-3",
          userId: "user-1",
        },
      },
      select: { role: true },
    });
    expect(prismaMock.task.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-3",
        title: "Create first board",
        description: "Draft first board structure",
        assigneeUserId: "user-2",
        dueAt: new Date("2026-03-20T12:00:00.000Z"),
      },
    });
    expect(prismaMock.activityEvent.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-3",
        actorUserId: "user-1",
        type: "TASK_CREATED",
        payloadJson: {
          taskId: "task-2",
          title: "Create first board",
          status: "TODO",
        },
      },
    });
    expect(body.task.workspaceId).toBe("workspace-3");
    expect(body.task.status).toBe("TODO");
    expect(body.task.assigneeUserId).toBe("user-2");
    expect(body.task.dueAt).toBe("2026-03-20T12:00:00.000Z");
  });

  it("returns 403 from POST when role cannot create tasks", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-3", name: "Client Workspace" }],
      activeWorkspace: { id: "workspace-3", name: "Client Workspace" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "VIEWER" });

    const { POST } = await import("@/app/api/tasks/route");
    const response = await POST(
      new Request("http://localhost:3000/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Create first board" }),
      }),
    );

    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Insufficient permissions to create tasks.");
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });

  it("returns 400 from POST when title is missing", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-3", name: "Client Workspace" }],
      activeWorkspace: { id: "workspace-3", name: "Client Workspace" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "ADMIN" });

    const { POST } = await import("@/app/api/tasks/route");
    const response = await POST(
      new Request("http://localhost:3000/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "   " }),
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Task title is required");
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });

  it("returns 400 from POST when dueAt is not a valid ISO date", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-3", name: "Client Workspace" }],
      activeWorkspace: { id: "workspace-3", name: "Client Workspace" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "ADMIN" });

    const { POST } = await import("@/app/api/tasks/route");
    const response = await POST(
      new Request("http://localhost:3000/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Create first board",
          dueAt: "not-a-date",
        }),
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Task due date must be a valid ISO date-time");
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });
});
