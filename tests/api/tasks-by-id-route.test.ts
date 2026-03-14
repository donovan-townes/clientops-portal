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
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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

describe("/api/tasks/[taskId]", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXTAUTH_SECRET = "test-secret";
    getServerSessionMock.mockReset();
    resolveActiveWorkspaceForUserMock.mockReset();
    prismaMock.membership.findUnique.mockReset();
    prismaMock.activityEvent.create.mockReset();
    prismaMock.task.findFirst.mockReset();
    prismaMock.task.update.mockReset();
    prismaMock.task.delete.mockReset();
  });

  it("returns 401 from PATCH when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/tasks/[taskId]/route");
    const response = await PATCH(
      new Request("http://localhost:3000/api/tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: Promise.resolve({ taskId: "task-1" }) },
    );

    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthenticated");
  });

  it("returns 403 from PATCH when role cannot edit tasks", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "VIEWER" });

    const { PATCH } = await import("@/app/api/tasks/[taskId]/route");
    const response = await PATCH(
      new Request("http://localhost:3000/api/tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: Promise.resolve({ taskId: "task-1" }) },
    );

    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Insufficient permissions to edit tasks.");
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });

  it("returns 404 from PATCH when task is not found in active workspace", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "CONTRIBUTOR" });
    prismaMock.task.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/tasks/[taskId]/route");
    const response = await PATCH(
      new Request("http://localhost:3000/api/tasks/task-missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: Promise.resolve({ taskId: "task-missing" }) },
    );

    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe("Task not found");
  });

  it("returns 400 from PATCH when status value is invalid", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "ADMIN" });
    prismaMock.task.findFirst.mockResolvedValue({
      id: "task-1",
      workspaceId: "workspace-1",
      status: "TODO",
    });

    const { PATCH } = await import("@/app/api/tasks/[taskId]/route");
    const response = await PATCH(
      new Request("http://localhost:3000/api/tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "NOT_A_REAL_STATUS" }),
      }),
      { params: Promise.resolve({ taskId: "task-1" }) },
    );

    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Task status is invalid");
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });

  it("updates a task for valid lifecycle transition and fields", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "CONTRIBUTOR" });
    prismaMock.task.findFirst.mockResolvedValue({
      id: "task-1",
      workspaceId: "workspace-1",
      status: "TODO",
    });
    prismaMock.task.update.mockResolvedValue({
      id: "task-1",
      workspaceId: "workspace-1",
      title: "Updated title",
      status: "IN_PROGRESS",
      assigneeUserId: "user-2",
      dueAt: "2026-03-30T09:00:00.000Z",
    });

    const { PATCH } = await import("@/app/api/tasks/[taskId]/route");
    const response = await PATCH(
      new Request("http://localhost:3000/api/tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "  Updated title  ",
          status: "IN_PROGRESS",
          assigneeUserId: "user-2",
          dueAt: "2026-03-30T09:00:00.000Z",
        }),
      }),
      { params: Promise.resolve({ taskId: "task-1" }) },
    );

    const body = (await response.json()) as {
      task: { id: string; status: string; workspaceId: string };
      activeWorkspaceId: string;
    };

    expect(response.status).toBe(200);
    expect(prismaMock.task.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: {
        title: "Updated title",
        status: "IN_PROGRESS",
        assigneeUserId: "user-2",
        dueAt: new Date("2026-03-30T09:00:00.000Z"),
      },
    });
    expect(prismaMock.activityEvent.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-1",
        actorUserId: "user-1",
        type: "TASK_STATUS_CHANGED",
        payloadJson: {
          taskId: "task-1",
          fromStatus: "TODO",
          toStatus: "IN_PROGRESS",
        },
      },
    });
    expect(body.task.id).toBe("task-1");
    expect(body.activeWorkspaceId).toBe("workspace-1");
  });

  it("returns 403 from DELETE when role cannot delete tasks", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "CONTRIBUTOR" });

    const { DELETE } = await import("@/app/api/tasks/[taskId]/route");
    const response = await DELETE(
      new Request("http://localhost:3000/api/tasks/task-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ taskId: "task-1" }) },
    );

    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Insufficient permissions to delete tasks.");
    expect(prismaMock.task.delete).not.toHaveBeenCalled();
  });

  it("deletes a task for OWNER role", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.task.findFirst.mockResolvedValue({
      id: "task-1",
      workspaceId: "workspace-1",
      status: "DONE",
    });
    prismaMock.task.delete.mockResolvedValue({ id: "task-1" });

    const { DELETE } = await import("@/app/api/tasks/[taskId]/route");
    const response = await DELETE(
      new Request("http://localhost:3000/api/tasks/task-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ taskId: "task-1" }) },
    );

    const body = (await response.json()) as {
      deletedTaskId: string;
      activeWorkspaceId: string;
    };

    expect(response.status).toBe(200);
    expect(prismaMock.task.findFirst).toHaveBeenCalledWith({
      where: {
        id: "task-1",
        workspaceId: "workspace-1",
      },
      select: {
        id: true,
        workspaceId: true,
        status: true,
      },
    });
    expect(prismaMock.task.delete).toHaveBeenCalledWith({
      where: { id: "task-1" },
    });
    expect(prismaMock.activityEvent.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-1",
        actorUserId: "user-1",
        type: "TASK_DELETED",
        payloadJson: {
          taskId: "task-1",
          status: "DONE",
        },
      },
    });
    expect(body.deletedTaskId).toBe("task-1");
    expect(body.activeWorkspaceId).toBe("workspace-1");
  });
});
