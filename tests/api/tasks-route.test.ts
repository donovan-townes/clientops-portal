import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const resolveActiveWorkspaceForUserMock = vi.fn();

const prismaMock = {
  task: {
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
    prismaMock.task.findMany.mockResolvedValue([
      { id: "task-1", title: "Task One", workspaceId: "workspace-2" },
    ]);

    const { GET } = await import("@/app/api/tasks/route");
    const response = await GET(new Request("http://localhost:3000/api/tasks"));
    const body = (await response.json()) as {
      activeWorkspaceId: string;
      tasks: Array<{ id: string; workspaceId: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.activeWorkspaceId).toBe("workspace-2");
    expect(body.tasks).toHaveLength(1);
    expect(prismaMock.task.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-2" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("creates a task under the resolved active workspace", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-3", name: "Client Workspace" }],
      activeWorkspace: { id: "workspace-3", name: "Client Workspace" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.task.create.mockResolvedValue({
      id: "task-2",
      title: "Create first board",
      workspaceId: "workspace-3",
    });

    const { POST } = await import("@/app/api/tasks/route");
    const response = await POST(
      new Request("http://localhost:3000/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Create first board" }),
      }),
    );

    const body = (await response.json()) as {
      task: { id: string; workspaceId: string };
      activeWorkspaceId: string;
    };

    expect(response.status).toBe(200);
    expect(body.activeWorkspaceId).toBe("workspace-3");
    expect(prismaMock.task.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-3",
        title: "Create first board",
        description: null,
      },
    });
    expect(body.task.workspaceId).toBe("workspace-3");
  });

  it("returns 400 from POST when title is missing", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-3", name: "Client Workspace" }],
      activeWorkspace: { id: "workspace-3", name: "Client Workspace" },
      shouldPersistActiveWorkspace: false,
    });

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
});
