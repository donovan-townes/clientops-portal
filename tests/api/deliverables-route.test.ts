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
    create: vi.fn(),
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

describe("/api/deliverables", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXTAUTH_SECRET = "test-secret";
    getServerSessionMock.mockReset();
    resolveActiveWorkspaceForUserMock.mockReset();
    prismaMock.membership.findUnique.mockReset();
    prismaMock.activityEvent.create.mockReset();
    prismaMock.deliverable.create.mockReset();
    prismaMock.deliverable.findMany.mockReset();
  });

  it("returns 401 from GET when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { GET } = await import("@/app/api/deliverables/route");
    const response = await GET(
      new Request("http://localhost:3000/api/deliverables"),
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

    const { GET } = await import("@/app/api/deliverables/route");
    const response = await GET(
      new Request("http://localhost:3000/api/deliverables"),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Insufficient permissions to view deliverables.");
    expect(prismaMock.deliverable.findMany).not.toHaveBeenCalled();
  });

  it("returns workspace-scoped deliverables from GET", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "VIEWER" });
    prismaMock.deliverable.findMany.mockResolvedValue([
      {
        id: "deliverable-1",
        workspaceId: "workspace-1",
        taskId: null,
        filename: "brief.pdf",
        storageKey: "workspace-1/some-random-brief.pdf",
        uploadedByUserId: "user-1",
      },
    ]);

    const { GET } = await import("@/app/api/deliverables/route");
    const response = await GET(
      new Request("http://localhost:3000/api/deliverables"),
    );
    const body = (await response.json()) as {
      activeWorkspaceId: string;
      deliverables: Array<{ id: string; workspaceId: string }>;
    };

    expect(response.status).toBe(200);
    expect(prismaMock.deliverable.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    expect(body.activeWorkspaceId).toBe("workspace-1");
    expect(body.deliverables).toHaveLength(1);
    expect(body.deliverables[0]?.id).toBe("deliverable-1");
  });

  it("returns 401 from POST when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const formData = new FormData();
    formData.set(
      "file",
      new Blob(["hello"], { type: "text/plain" }),
      "hello.txt",
    );

    const { POST } = await import("@/app/api/deliverables/route");
    const response = await POST(
      new Request("http://localhost:3000/api/deliverables", {
        method: "POST",
        body: formData,
      }),
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

    const formData = new FormData();
    formData.set(
      "file",
      new Blob(["hello"], { type: "text/plain" }),
      "hello.txt",
    );

    const { POST } = await import("@/app/api/deliverables/route");
    const response = await POST(
      new Request("http://localhost:3000/api/deliverables", {
        method: "POST",
        body: formData,
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("No active workspace. Create a workspace first.");
  });

  it("returns 403 from POST when caller cannot upload files", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "VIEWER" });

    const formData = new FormData();
    formData.set(
      "file",
      new Blob(["hello"], { type: "text/plain" }),
      "hello.txt",
    );

    const { POST } = await import("@/app/api/deliverables/route");
    const response = await POST(
      new Request("http://localhost:3000/api/deliverables", {
        method: "POST",
        body: formData,
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Insufficient permissions to upload files.");
    expect(prismaMock.deliverable.create).not.toHaveBeenCalled();
  });

  it("returns 400 from POST when upload file is missing", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "CONTRIBUTOR" });

    const { POST } = await import("@/app/api/deliverables/route");
    const response = await POST(
      new Request("http://localhost:3000/api/deliverables", {
        method: "POST",
        body: new FormData(),
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("File is required");
    expect(prismaMock.deliverable.create).not.toHaveBeenCalled();
  });

  it("returns 400 from POST when file type is not allowed", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "CONTRIBUTOR" });

    const formData = new FormData();
    formData.set(
      "file",
      new File(["not allowed"], "malware.exe", {
        type: "application/octet-stream",
      }),
    );

    const { POST } = await import("@/app/api/deliverables/route");
    const response = await POST(
      new Request("http://localhost:3000/api/deliverables", {
        method: "POST",
        body: formData,
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("File type is not allowed");
    expect(prismaMock.deliverable.create).not.toHaveBeenCalled();
  });

  it("returns 400 from POST when file size exceeds 5MB", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "CONTRIBUTOR" });

    const oversizedBytes = new Uint8Array(5 * 1024 * 1024 + 1);
    const formData = new FormData();
    formData.set(
      "file",
      new File([oversizedBytes], "large.pdf", { type: "application/pdf" }),
    );

    const { POST } = await import("@/app/api/deliverables/route");
    const response = await POST(
      new Request("http://localhost:3000/api/deliverables", {
        method: "POST",
        body: formData,
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("File size must be 5MB or less");
    expect(prismaMock.deliverable.create).not.toHaveBeenCalled();
  });

  it("creates deliverable metadata for valid upload payload", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    prismaMock.membership.findUnique.mockResolvedValue({ role: "CONTRIBUTOR" });
    prismaMock.deliverable.create.mockResolvedValue({
      id: "deliverable-1",
      workspaceId: "workspace-1",
      taskId: "task-1",
      filename: "brief.pdf",
      storageKey: "workspace-1/some-random-brief.pdf",
      uploadedByUserId: "user-1",
    });

    const formData = new FormData();
    formData.set(
      "file",
      new File(["pdf-content"], "brief.pdf", { type: "application/pdf" }),
    );
    formData.set("taskId", "task-1");

    const { POST } = await import("@/app/api/deliverables/route");
    const response = await POST(
      new Request("http://localhost:3000/api/deliverables", {
        method: "POST",
        body: formData,
      }),
    );
    const body = (await response.json()) as {
      activeWorkspaceId: string;
      deliverable: {
        id: string;
        workspaceId: string;
        taskId: string | null;
        filename: string;
        uploadedByUserId: string;
      };
    };

    expect(response.status).toBe(201);
    expect(prismaMock.deliverable.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        taskId: "task-1",
        filename: "brief.pdf",
        uploadedByUserId: "user-1",
      }),
    });
    expect(prismaMock.activityEvent.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-1",
        actorUserId: "user-1",
        type: "FILE_UPLOADED",
        payloadJson: {
          deliverableId: "deliverable-1",
          filename: "brief.pdf",
          taskId: "task-1",
        },
      },
    });
    expect(body.activeWorkspaceId).toBe("workspace-1");
    expect(body.deliverable.id).toBe("deliverable-1");
  });
});
