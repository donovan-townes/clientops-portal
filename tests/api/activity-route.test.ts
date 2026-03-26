import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const resolveActiveWorkspaceForUserMock = vi.fn();

const prismaMock = {
  membership: {
    findUnique: vi.fn(),
  },
  activityEvent: {
    findMany: vi.fn(),
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

describe("/api/activity", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXTAUTH_SECRET = "test-secret";
    getServerSessionMock.mockReset();
    resolveActiveWorkspaceForUserMock.mockReset();
    prismaMock.membership.findUnique.mockReset();
    prismaMock.activityEvent.findMany.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { GET } = await import("@/app/api/activity/route");
    const response = await GET(
      new Request("http://localhost:3000/api/activity"),
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

    const { GET } = await import("@/app/api/activity/route");
    const response = await GET(
      new Request("http://localhost:3000/api/activity"),
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

    const { GET } = await import("@/app/api/activity/route");
    const response = await GET(
      new Request("http://localhost:3000/api/activity"),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Insufficient permissions to view activity log.");
    expect(prismaMock.activityEvent.findMany).not.toHaveBeenCalled();
  });

  it("returns workspace-scoped activity events ordered newest first for any role", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "VIEWER" });
    prismaMock.activityEvent.findMany.mockResolvedValue([
      {
        id: "event-1",
        workspaceId: "workspace-1",
        actorUserId: "user-1",
        type: "TASK_CREATED",
        payloadJson: { taskId: "task-1", title: "Build dashboard" },
        createdAt: new Date("2026-03-25T10:00:00.000Z"),
        actor: { email: "owner@example.com" },
      },
      {
        id: "event-2",
        workspaceId: "workspace-1",
        actorUserId: "user-1",
        type: "FILE_UPLOADED",
        payloadJson: { deliverableId: "del-1", filename: "spec.pdf" },
        createdAt: new Date("2026-03-25T09:00:00.000Z"),
        actor: { email: "owner@example.com" },
      },
    ]);

    const { GET } = await import("@/app/api/activity/route");
    const response = await GET(
      new Request("http://localhost:3000/api/activity"),
    );
    const body = (await response.json()) as {
      events: {
        id: string;
        type: string;
        actorUserId: string;
        actorEmail: string;
        payloadJson: unknown;
        createdAt: string;
        workspaceId: string;
      }[];
      activeWorkspaceId: string;
    };

    expect(response.status).toBe(200);
    expect(prismaMock.activityEvent.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-1" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { actor: { select: { email: true } } },
    });
    expect(body.events).toHaveLength(2);
    expect(body.events[0]).toMatchObject({
      id: "event-1",
      type: "TASK_CREATED",
      actorUserId: "user-1",
      actorEmail: "owner@example.com",
      workspaceId: "workspace-1",
    });
    expect(body.events[0].createdAt).toBe("2026-03-25T10:00:00.000Z");
    expect(body.activeWorkspaceId).toBe("workspace-1");
  });
});
