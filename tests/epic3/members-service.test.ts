import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  membership: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("EPIC 3 — members service", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.membership.findUnique.mockReset();
    prismaMock.membership.findMany.mockReset();
  });

  it("throws when caller is not a workspace member", async () => {
    prismaMock.membership.findUnique.mockResolvedValue(null);

    const { listMembersForWorkspace } = await import("@/lib/members");

    await expect(
      listMembersForWorkspace("user-1", "workspace-1"),
    ).rejects.toThrow("Workspace access denied.");
  });

  it("returns active role and scoped members", async () => {
    prismaMock.membership.findUnique.mockResolvedValue({
      id: "membership-active",
      workspaceId: "workspace-1",
      userId: "user-1",
      role: Role.ADMIN,
    });
    prismaMock.membership.findMany.mockResolvedValue([
      {
        id: "membership-1",
        workspaceId: "workspace-1",
        userId: "user-1",
        role: Role.OWNER,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        user: { email: "owner@example.com" },
      },
      {
        id: "membership-2",
        workspaceId: "workspace-1",
        userId: "user-2",
        role: Role.CONTRIBUTOR,
        createdAt: new Date("2026-03-02T00:00:00.000Z"),
        user: { email: "member@example.com" },
      },
    ]);

    const { listMembersForWorkspace } = await import("@/lib/members");

    const result = await listMembersForWorkspace("user-1", "workspace-1");

    expect(result.activeRole).toBe(Role.ADMIN);
    expect(result.members).toHaveLength(2);
    expect(result.members[0]).toMatchObject({
      id: "membership-1",
      email: "owner@example.com",
      role: Role.OWNER,
    });
    expect(prismaMock.membership.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-1" },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  });
});
