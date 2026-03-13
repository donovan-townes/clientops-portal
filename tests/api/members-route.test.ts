import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const resolveActiveWorkspaceForUserMock = vi.fn();
const listMembersForWorkspaceMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/workspaces", () => ({
  resolveActiveWorkspaceForUser: resolveActiveWorkspaceForUserMock,
}));

vi.mock("@/lib/members", () => ({
  listMembersForWorkspace: listMembersForWorkspaceMock,
}));

describe("/api/members", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXTAUTH_SECRET = "test-secret";
    getServerSessionMock.mockReset();
    resolveActiveWorkspaceForUserMock.mockReset();
    listMembersForWorkspaceMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { GET } = await import("@/app/api/members/route");
    const response = await GET(
      new Request("http://localhost:3000/api/members"),
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

    const { GET } = await import("@/app/api/members/route");
    const response = await GET(
      new Request("http://localhost:3000/api/members"),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("No active workspace. Create a workspace first.");
  });

  it("returns members scoped to active workspace and caller role", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    listMembersForWorkspaceMock.mockResolvedValue({
      activeRole: "ADMIN",
      members: [
        {
          id: "membership-1",
          userId: "user-1",
          email: "owner@example.com",
          role: "OWNER",
          workspaceId: "workspace-1",
        },
      ],
    });

    const { GET } = await import("@/app/api/members/route");
    const response = await GET(
      new Request("http://localhost:3000/api/members", {
        headers: { cookie: "activeWorkspaceId=workspace-1" },
      }),
    );
    const body = (await response.json()) as {
      activeWorkspaceId: string;
      activeRole: string;
      members: Array<{ id: string; role: string; workspaceId: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.activeWorkspaceId).toBe("workspace-1");
    expect(body.activeRole).toBe("ADMIN");
    expect(body.members).toHaveLength(1);
    expect(listMembersForWorkspaceMock).toHaveBeenCalledWith(
      "user-1",
      "workspace-1",
    );
  });

  it("returns 403 when caller has no workspace membership", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveWorkspaceForUserMock.mockResolvedValue({
      workspaces: [{ id: "workspace-1", name: "Acme" }],
      activeWorkspace: { id: "workspace-1", name: "Acme" },
      shouldPersistActiveWorkspace: false,
    });
    listMembersForWorkspaceMock.mockRejectedValue(
      new Error("Workspace access denied."),
    );

    const { GET } = await import("@/app/api/members/route");
    const response = await GET(
      new Request("http://localhost:3000/api/members"),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Workspace access denied.");
  });
});
