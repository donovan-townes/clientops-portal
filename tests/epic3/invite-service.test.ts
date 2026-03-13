import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  membership: {
    findUnique: vi.fn(),
  },
  invite: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("EPIC 3 — createInvite service", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.membership.findUnique.mockReset();
    prismaMock.invite.create.mockReset();
  });

  it("throws when the actor is not a member of the workspace", async () => {
    prismaMock.membership.findUnique.mockResolvedValue(null);

    const { createInvite } = await import("@/lib/invites");

    await expect(
      createInvite(
        "user-1",
        "workspace-1",
        "new@example.com",
        Role.CONTRIBUTOR,
      ),
    ).rejects.toThrow("Only workspace Owners and Admins can invite members.");
  });

  it("throws when the actor's role is CONTRIBUTOR", async () => {
    prismaMock.membership.findUnique.mockResolvedValue({
      id: "m-1",
      userId: "user-1",
      workspaceId: "workspace-1",
      role: Role.CONTRIBUTOR,
    });

    const { createInvite } = await import("@/lib/invites");

    await expect(
      createInvite(
        "user-1",
        "workspace-1",
        "new@example.com",
        Role.CONTRIBUTOR,
      ),
    ).rejects.toThrow("Only workspace Owners and Admins can invite members.");
  });

  it("throws when the actor's role is VIEWER", async () => {
    prismaMock.membership.findUnique.mockResolvedValue({
      id: "m-1",
      userId: "user-1",
      workspaceId: "workspace-1",
      role: Role.VIEWER,
    });

    const { createInvite } = await import("@/lib/invites");

    await expect(
      createInvite("user-1", "workspace-1", "new@example.com", Role.VIEWER),
    ).rejects.toThrow("Only workspace Owners and Admins can invite members.");
  });

  it("creates an invite when the actor is an OWNER", async () => {
    prismaMock.membership.findUnique.mockResolvedValue({
      id: "m-1",
      userId: "user-owner",
      workspaceId: "workspace-1",
      role: Role.OWNER,
    });
    prismaMock.invite.create.mockResolvedValue({
      id: "invite-1",
      workspaceId: "workspace-1",
      email: "invitee@example.com",
      role: Role.CONTRIBUTOR,
      token: "generated-token",
      expiresAt: new Date("2026-03-19"),
      acceptedAt: null,
      createdAt: new Date("2026-03-12"),
    });

    const { createInvite } = await import("@/lib/invites");

    const result = await createInvite(
      "user-owner",
      "workspace-1",
      "invitee@example.com",
      Role.CONTRIBUTOR,
    );

    expect(result).toMatchObject({
      id: "invite-1",
      email: "invitee@example.com",
    });
    expect(prismaMock.invite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        email: "invitee@example.com",
        role: Role.CONTRIBUTOR,
      }),
    });
  });

  it("creates an invite when the actor is an ADMIN", async () => {
    prismaMock.membership.findUnique.mockResolvedValue({
      id: "m-2",
      userId: "user-admin",
      workspaceId: "workspace-1",
      role: Role.ADMIN,
    });
    prismaMock.invite.create.mockResolvedValue({
      id: "invite-2",
      workspaceId: "workspace-1",
      email: "teammember@example.com",
      role: Role.VIEWER,
      token: "generated-token-2",
      expiresAt: new Date("2026-03-19"),
      acceptedAt: null,
      createdAt: new Date("2026-03-12"),
    });

    const { createInvite } = await import("@/lib/invites");

    const result = await createInvite(
      "user-admin",
      "workspace-1",
      "teammember@example.com",
      Role.VIEWER,
    );

    expect(result).toMatchObject({ id: "invite-2" });
    expect(prismaMock.membership.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: "workspace-1",
          userId: "user-admin",
        },
      },
    });
  });
});
