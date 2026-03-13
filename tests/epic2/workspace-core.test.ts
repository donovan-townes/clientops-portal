import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  workspace: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  membership: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("EPIC 2 Workspace Core", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.workspace.create.mockReset();
    prismaMock.workspace.findMany.mockReset();
    prismaMock.membership.findUnique.mockReset();
  });

  it("creates a workspace for the signed-in user", async () => {
    prismaMock.workspace.create.mockResolvedValue({
      id: "workspace-1",
      name: "Acme Studio",
      memberships: [{ userId: "user-1", role: "OWNER" }],
    });

    const { createWorkspaceForUser } = await import("@/lib/workspaces");

    const result = await createWorkspaceForUser("user-1", "Acme Studio");

    expect(result).toMatchObject({
      id: "workspace-1",
      name: "Acme Studio",
    });
  });

  it("creates an OWNER membership for the creator when a workspace is created", async () => {
    prismaMock.workspace.create.mockResolvedValue({
      id: "workspace-2",
      name: "Beta Client",
      memberships: [{ userId: "user-2", role: "OWNER" }],
    });

    const { createWorkspaceForUser } = await import("@/lib/workspaces");

    await createWorkspaceForUser("user-2", "Beta Client");

    expect(prismaMock.workspace.create).toHaveBeenCalledWith({
      data: {
        name: "Beta Client",
        memberships: {
          create: {
            userId: "user-2",
            role: "OWNER",
          },
        },
      },
      include: {
        memberships: true,
      },
    });
  });

  it("returns only workspaces the current user belongs to when listing workspaces", async () => {
    prismaMock.workspace.findMany.mockResolvedValue([
      { id: "workspace-1", name: "Acme Studio" },
      { id: "workspace-2", name: "Beta Client" },
    ]);

    const { listWorkspacesForUser } = await import("@/lib/workspaces");

    const result = await listWorkspacesForUser("user-1");

    expect(prismaMock.workspace.findMany).toHaveBeenCalledWith({
      where: {
        memberships: {
          some: {
            userId: "user-1",
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    expect(result).toHaveLength(2);
  });

  it("rejects active-workspace selection when the user is not a member of that workspace", async () => {
    prismaMock.membership.findUnique.mockResolvedValue(null);

    const { assertWorkspaceAccessForUser } = await import("@/lib/workspaces");

    await expect(
      assertWorkspaceAccessForUser("user-1", "workspace-x"),
    ).rejects.toThrow("Workspace access denied.");
  });

  it("allows active-workspace selection when the user is a member of that workspace", async () => {
    prismaMock.membership.findUnique.mockResolvedValue({
      id: "membership-1",
      userId: "user-1",
      workspaceId: "workspace-1",
      role: "OWNER",
    });

    const { assertWorkspaceAccessForUser } = await import("@/lib/workspaces");

    await expect(
      assertWorkspaceAccessForUser("user-1", "workspace-1"),
    ).resolves.toMatchObject({
      workspaceId: "workspace-1",
      userId: "user-1",
    });
  });

  it("resolves active workspace from cookie when it belongs to the user", async () => {
    prismaMock.workspace.findMany.mockResolvedValue([
      { id: "workspace-1", name: "Acme Studio" },
      { id: "workspace-2", name: "Beta Client" },
    ]);

    const { resolveActiveWorkspaceForUser } = await import("@/lib/workspaces");

    const result = await resolveActiveWorkspaceForUser("user-1", "workspace-2");

    expect(result).toMatchObject({
      activeWorkspace: { id: "workspace-2" },
      shouldPersistActiveWorkspace: false,
    });
  });

  it("falls back to first workspace and asks to persist cookie when current cookie is invalid", async () => {
    prismaMock.workspace.findMany.mockResolvedValue([
      { id: "workspace-1", name: "Acme Studio" },
      { id: "workspace-2", name: "Beta Client" },
    ]);

    const { resolveActiveWorkspaceForUser } = await import("@/lib/workspaces");

    const result = await resolveActiveWorkspaceForUser("user-1", "workspace-x");

    expect(result).toMatchObject({
      activeWorkspace: { id: "workspace-1" },
      shouldPersistActiveWorkspace: true,
    });
  });
});
