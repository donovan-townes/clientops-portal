import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const resolveActiveWorkspaceForUserMock = vi.fn();

const prismaMock = {
  membership: {
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  task: {
    count: vi.fn(),
  },
  deliverable: {
    count: vi.fn(),
  },
  activityEvent: {
    count: vi.fn(),
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

describe("/api/dashboard/summary", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXTAUTH_SECRET = "test-secret";
    getServerSessionMock.mockReset();
    resolveActiveWorkspaceForUserMock.mockReset();
    prismaMock.membership.findUnique.mockReset();
    prismaMock.membership.count.mockReset();
    prismaMock.task.count.mockReset();
    prismaMock.deliverable.count.mockReset();
    prismaMock.activityEvent.count.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { GET } = await import("@/app/api/dashboard/summary/route");
    const response = await GET(
      new Request("http://localhost:3000/api/dashboard/summary"),
    );
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

    const { GET } = await import("@/app/api/dashboard/summary/route");
    const response = await GET(
      new Request("http://localhost:3000/api/dashboard/summary"),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("No active workspace. Create a workspace first.");
  });

  it("returns 403 when caller has no workspace membership", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/dashboard/summary/route");
    const response = await GET(
      new Request("http://localhost:3000/api/dashboard/summary"),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe(
      "Insufficient permissions to view dashboard summary.",
    );
    expect(prismaMock.task.count).not.toHaveBeenCalled();
  });

  it("returns workspace-scoped summary counts", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "VIEWER" });

    prismaMock.task.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    prismaMock.deliverable.count.mockResolvedValue(9);
    prismaMock.membership.count.mockResolvedValue(5);
    prismaMock.activityEvent.count.mockResolvedValue(18);

    const { GET } = await import("@/app/api/dashboard/summary/route");
    const response = await GET(
      new Request("http://localhost:3000/api/dashboard/summary"),
    );
    const body = (await response.json()) as {
      activeWorkspaceId: string;
      summary: {
        tasksTotal: number;
        tasksTodo: number;
        tasksInProgress: number;
        tasksDone: number;
        deliverablesTotal: number;
        membersTotal: number;
        activityEventsTotal: number;
      };
    };

    expect(response.status).toBe(200);
    expect(prismaMock.task.count).toHaveBeenNthCalledWith(1, {
      where: { workspaceId: "workspace-1" },
    });
    expect(prismaMock.task.count).toHaveBeenNthCalledWith(2, {
      where: { workspaceId: "workspace-1", status: "TODO" },
    });
    expect(prismaMock.task.count).toHaveBeenNthCalledWith(3, {
      where: { workspaceId: "workspace-1", status: "IN_PROGRESS" },
    });
    expect(prismaMock.task.count).toHaveBeenNthCalledWith(4, {
      where: { workspaceId: "workspace-1", status: "DONE" },
    });
    expect(prismaMock.deliverable.count).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-1" },
    });
    expect(prismaMock.membership.count).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-1" },
    });
    expect(prismaMock.activityEvent.count).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-1" },
    });
    expect(body.activeWorkspaceId).toBe("workspace-1");
    expect(body.summary).toEqual({
      tasksTotal: 12,
      tasksTodo: 6,
      tasksInProgress: 4,
      tasksDone: 2,
      deliverablesTotal: 9,
      membersTotal: 5,
      activityEventsTotal: 18,
    });
  });
});
