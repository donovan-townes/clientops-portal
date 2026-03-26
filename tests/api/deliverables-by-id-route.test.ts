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
  deliverable: {
    findFirst: vi.fn(),
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

describe("/api/deliverables/[deliverableId]", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXTAUTH_SECRET = "test-secret";
    getServerSessionMock.mockReset();
    resolveActiveWorkspaceForUserMock.mockReset();
    prismaMock.membership.findUnique.mockReset();
    prismaMock.activityEvent.create.mockReset();
    prismaMock.deliverable.findFirst.mockReset();
    prismaMock.deliverable.delete.mockReset();
  });

  it("returns 401 from GET when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { GET } =
      await import("@/app/api/deliverables/[deliverableId]/route");
    const response = await GET(
      new Request("http://localhost:3000/api/deliverables/deliverable-1"),
      { params: Promise.resolve({ deliverableId: "deliverable-1" }) },
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthenticated");
  });

  it("returns 403 from GET when caller cannot view files", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue(null);

    const { GET } =
      await import("@/app/api/deliverables/[deliverableId]/route");
    const response = await GET(
      new Request("http://localhost:3000/api/deliverables/deliverable-1"),
      { params: Promise.resolve({ deliverableId: "deliverable-1" }) },
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Insufficient permissions to view deliverables.");
    expect(prismaMock.deliverable.findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 from GET when deliverable is not in active workspace", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "VIEWER" });
    prismaMock.deliverable.findFirst.mockResolvedValue(null);

    const { GET } =
      await import("@/app/api/deliverables/[deliverableId]/route");
    const response = await GET(
      new Request("http://localhost:3000/api/deliverables/deliverable-missing"),
      { params: Promise.resolve({ deliverableId: "deliverable-missing" }) },
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe("Deliverable not found");
  });

  it("returns deliverable metadata for workspace-scoped GET", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "VIEWER" });
    prismaMock.deliverable.findFirst.mockResolvedValue({
      id: "deliverable-1",
      workspaceId: "workspace-1",
      taskId: null,
      filename: "brief.pdf",
      storageKey: "workspace-1/some-random-brief.pdf",
      uploadedByUserId: "user-1",
    });

    const { GET } =
      await import("@/app/api/deliverables/[deliverableId]/route");
    const response = await GET(
      new Request("http://localhost:3000/api/deliverables/deliverable-1"),
      { params: Promise.resolve({ deliverableId: "deliverable-1" }) },
    );
    const body = (await response.json()) as {
      activeWorkspaceId: string;
      deliverable: {
        id: string;
        workspaceId: string;
        filename: string;
      };
    };

    expect(response.status).toBe(200);
    expect(prismaMock.deliverable.findFirst).toHaveBeenCalledWith({
      where: {
        id: "deliverable-1",
        workspaceId: "workspace-1",
      },
    });
    expect(body.activeWorkspaceId).toBe("workspace-1");
    expect(body.deliverable.id).toBe("deliverable-1");
  });

  it("returns 403 from DELETE when role cannot delete files", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "CONTRIBUTOR" });

    const { DELETE } =
      await import("@/app/api/deliverables/[deliverableId]/route");
    const response = await DELETE(
      new Request("http://localhost:3000/api/deliverables/deliverable-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ deliverableId: "deliverable-1" }) },
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Insufficient permissions to delete deliverables.");
    expect(prismaMock.deliverable.delete).not.toHaveBeenCalled();
  });

  it("deletes a deliverable for OWNER role and logs activity", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.deliverable.findFirst.mockResolvedValue({
      id: "deliverable-1",
      workspaceId: "workspace-1",
      taskId: "task-1",
      filename: "brief.pdf",
      storageKey: "workspace-1/some-random-brief.pdf",
      uploadedByUserId: "user-1",
    });
    prismaMock.deliverable.delete.mockResolvedValue({ id: "deliverable-1" });

    const { DELETE } =
      await import("@/app/api/deliverables/[deliverableId]/route");
    const response = await DELETE(
      new Request("http://localhost:3000/api/deliverables/deliverable-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ deliverableId: "deliverable-1" }) },
    );
    const body = (await response.json()) as {
      activeWorkspaceId: string;
      deletedDeliverableId: string;
    };

    expect(response.status).toBe(200);
    expect(prismaMock.deliverable.delete).toHaveBeenCalledWith({
      where: { id: "deliverable-1" },
    });
    expect(prismaMock.activityEvent.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-1",
        actorUserId: "user-1",
        type: "FILE_DELETED",
        payloadJson: {
          deliverableId: "deliverable-1",
          filename: "brief.pdf",
          taskId: "task-1",
        },
      },
    });
    expect(body.activeWorkspaceId).toBe("workspace-1");
    expect(body.deletedDeliverableId).toBe("deliverable-1");
  });
});
