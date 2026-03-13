import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const createWorkspaceForUserMock = vi.fn();
const listWorkspacesForUserMock = vi.fn();
const assertWorkspaceAccessForUserMock = vi.fn();
const resolveActiveWorkspaceForUserMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/workspaces", () => ({
  createWorkspaceForUser: createWorkspaceForUserMock,
  listWorkspacesForUser: listWorkspacesForUserMock,
  assertWorkspaceAccessForUser: assertWorkspaceAccessForUserMock,
  resolveActiveWorkspaceForUser: resolveActiveWorkspaceForUserMock,
}));

describe("/api/workspaces", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXTAUTH_SECRET = "test-secret";
    getServerSessionMock.mockReset();
    createWorkspaceForUserMock.mockReset();
    listWorkspacesForUserMock.mockReset();
    assertWorkspaceAccessForUserMock.mockReset();
    resolveActiveWorkspaceForUserMock.mockReset();
  });

  it("returns 401 from POST when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { POST } = await import("@/app/api/workspaces/route");

    const request = new Request("http://localhost:3000/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Acme Studio" }),
    });

    const response = await POST(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthenticated");
  });

  it("returns 400 from POST when workspace name is missing", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    const { POST } = await import("@/app/api/workspaces/route");

    const request = new Request("http://localhost:3000/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });

    const response = await POST(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Workspace name is required");
  });

  it("creates a workspace, returns it, and sets the active workspace cookie", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    createWorkspaceForUserMock.mockResolvedValue({
      id: "workspace-1",
      name: "Acme Studio",
    });

    const { POST } = await import("@/app/api/workspaces/route");

    const request = new Request("http://localhost:3000/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Acme Studio" }),
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      workspace: { id: string; name: string };
    };

    expect(response.status).toBe(200);
    expect(body.workspace).toEqual({
      id: "workspace-1",
      name: "Acme Studio",
    });
    expect(createWorkspaceForUserMock).toHaveBeenCalledWith(
      "user-1",
      "Acme Studio",
    );
    expect(response.cookies.get("activeWorkspaceId")?.value).toBe(
      "workspace-1",
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("returns only the current user's workspaces from GET and includes active workspace id", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [
        { id: "workspace-1", name: "Acme Studio" },
        { id: "workspace-2", name: "Beta Client" },
      ],
      activeWorkspace: { id: "workspace-2", name: "Beta Client" },
      shouldPersistActiveWorkspace: false,
    });

    const { GET } = await import("@/app/api/workspaces/route");

    const request = new Request("http://localhost:3000/api/workspaces", {
      headers: {
        cookie: "activeWorkspaceId=workspace-2",
      },
    });

    const response = await GET(request);
    const body = (await response.json()) as {
      workspaces: Array<{ id: string; name: string }>;
      activeWorkspaceId: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.workspaces).toHaveLength(2);
    expect(body.activeWorkspaceId).toBe("workspace-2");
    expect(resolveActiveWorkspaceForUserMock).toHaveBeenCalledWith(
      "user-1",
      "workspace-2",
    );
  });

  it("persists fallback active workspace cookie from GET when current cookie is missing or invalid", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme Studio" }],
      activeWorkspace: { id: "workspace-1", name: "Acme Studio" },
      shouldPersistActiveWorkspace: true,
    });

    const { GET } = await import("@/app/api/workspaces/route");

    const request = new Request("http://localhost:3000/api/workspaces");

    const response = await GET(request);
    const body = (await response.json()) as {
      activeWorkspaceId: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.activeWorkspaceId).toBe("workspace-1");
    expect(response.cookies.get("activeWorkspaceId")?.value).toBe(
      "workspace-1",
    );
  });
});

describe("/api/workspaces/active", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXTAUTH_SECRET = "test-secret";
    getServerSessionMock.mockReset();
    createWorkspaceForUserMock.mockReset();
    listWorkspacesForUserMock.mockReset();
    assertWorkspaceAccessForUserMock.mockReset();
    resolveActiveWorkspaceForUserMock.mockReset();
  });

  it("returns 401 when switching active workspace while unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { POST } = await import("@/app/api/workspaces/active/route");

    const request = new Request("http://localhost:3000/api/workspaces/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: "workspace-1" }),
    });

    const response = await POST(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthenticated");
  });

  it("returns 403 when the user is not a member of the selected workspace", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    assertWorkspaceAccessForUserMock.mockRejectedValue(
      new Error("Workspace access denied."),
    );

    const { POST } = await import("@/app/api/workspaces/active/route");

    const request = new Request("http://localhost:3000/api/workspaces/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: "workspace-x" }),
    });

    const response = await POST(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Workspace access denied.");
  });

  it("sets the active workspace cookie when the user is a member", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    assertWorkspaceAccessForUserMock.mockResolvedValue({
      workspaceId: "workspace-1",
    });

    const { POST } = await import("@/app/api/workspaces/active/route");

    const request = new Request("http://localhost:3000/api/workspaces/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: "workspace-1" }),
    });

    const response = await POST(request);
    const body = (await response.json()) as { success: boolean };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(assertWorkspaceAccessForUserMock).toHaveBeenCalledWith(
      "user-1",
      "workspace-1",
    );
    expect(response.cookies.get("activeWorkspaceId")?.value).toBe(
      "workspace-1",
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
});
