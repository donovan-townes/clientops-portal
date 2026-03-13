import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const txMock = {
  membership: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  invite: {
    update: vi.fn(),
  },
};

const prismaMock = {
  invite: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("EPIC 3 — acceptInvite service", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.invite.findUnique.mockReset();
    prismaMock.$transaction.mockReset();
    txMock.membership.findUnique.mockReset();
    txMock.membership.create.mockReset();
    txMock.invite.update.mockReset();
  });

  it("throws when invite token is not found", async () => {
    prismaMock.invite.findUnique.mockResolvedValue(null);

    const { acceptInvite } = await import("@/lib/invites");

    await expect(
      acceptInvite("user-1", "invitee@example.com", "missing-token"),
    ).rejects.toThrow("Invite token not found");
  });

  it("throws when invite token is expired", async () => {
    prismaMock.invite.findUnique.mockResolvedValue({
      id: "invite-1",
      workspaceId: "workspace-1",
      email: "invitee@example.com",
      role: Role.CONTRIBUTOR,
      token: "expired-token",
      expiresAt: new Date("2026-03-01T00:00:00.000Z"),
      acceptedAt: null,
      createdAt: new Date("2026-02-20T00:00:00.000Z"),
    });

    const { acceptInvite } = await import("@/lib/invites");

    await expect(
      acceptInvite("user-1", "invitee@example.com", "expired-token"),
    ).rejects.toThrow("Invite has expired");
  });

  it("throws when invite token has already been accepted", async () => {
    prismaMock.invite.findUnique.mockResolvedValue({
      id: "invite-1",
      workspaceId: "workspace-1",
      email: "invitee@example.com",
      role: Role.CONTRIBUTOR,
      token: "accepted-token",
      expiresAt: new Date("2026-03-20T00:00:00.000Z"),
      acceptedAt: new Date("2026-03-10T00:00:00.000Z"),
      createdAt: new Date("2026-02-20T00:00:00.000Z"),
    });

    const { acceptInvite } = await import("@/lib/invites");

    await expect(
      acceptInvite("user-1", "invitee@example.com", "accepted-token"),
    ).rejects.toThrow("Invite has already been accepted");
  });

  it("throws when the invite email does not match the signed-in user email", async () => {
    prismaMock.invite.findUnique.mockResolvedValue({
      id: "invite-1",
      workspaceId: "workspace-1",
      email: "other-user@example.com",
      role: Role.CONTRIBUTOR,
      token: "valid-token",
      expiresAt: new Date("2026-03-20T00:00:00.000Z"),
      acceptedAt: null,
      createdAt: new Date("2026-02-20T00:00:00.000Z"),
    });

    const { acceptInvite } = await import("@/lib/invites");

    await expect(
      acceptInvite("user-1", "invitee@example.com", "valid-token"),
    ).rejects.toThrow("Invite is intended for a different email address");
  });

  it("creates membership and marks invite accepted when user is not already a member", async () => {
    prismaMock.invite.findUnique.mockResolvedValue({
      id: "invite-1",
      workspaceId: "workspace-1",
      email: "invitee@example.com",
      role: Role.CONTRIBUTOR,
      token: "valid-token",
      expiresAt: new Date("2026-03-20T00:00:00.000Z"),
      acceptedAt: null,
      createdAt: new Date("2026-02-20T00:00:00.000Z"),
    });

    txMock.membership.findUnique.mockResolvedValue(null);
    txMock.membership.create.mockResolvedValue({
      id: "membership-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      role: Role.CONTRIBUTOR,
    });
    txMock.invite.update.mockResolvedValue({
      id: "invite-1",
      workspaceId: "workspace-1",
      email: "invitee@example.com",
      role: Role.CONTRIBUTOR,
      token: "valid-token",
      expiresAt: new Date("2026-03-20T00:00:00.000Z"),
      acceptedAt: new Date("2026-03-12T00:00:00.000Z"),
      createdAt: new Date("2026-02-20T00:00:00.000Z"),
    });
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(txMock),
    );

    const { acceptInvite } = await import("@/lib/invites");

    const result = await acceptInvite(
      "user-1",
      "invitee@example.com",
      "valid-token",
    );

    expect(result.membership.id).toBe("membership-1");
    expect(result.invite.id).toBe("invite-1");
    expect(txMock.membership.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: "workspace-1",
          userId: "user-1",
        },
      },
    });
    expect(txMock.membership.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-1",
        userId: "user-1",
        role: Role.CONTRIBUTOR,
      },
    });
    expect(txMock.invite.update).toHaveBeenCalledWith({
      where: { id: "invite-1" },
      data: { acceptedAt: expect.any(Date) },
    });
  });

  it("keeps existing membership role when invite is accepted by an existing member", async () => {
    prismaMock.invite.findUnique.mockResolvedValue({
      id: "invite-1",
      workspaceId: "workspace-1",
      email: "owner@example.com",
      role: Role.CONTRIBUTOR,
      token: "valid-token",
      expiresAt: new Date("2026-03-20T00:00:00.000Z"),
      acceptedAt: null,
      createdAt: new Date("2026-02-20T00:00:00.000Z"),
    });

    txMock.membership.findUnique.mockResolvedValue({
      id: "membership-owner",
      workspaceId: "workspace-1",
      userId: "user-owner",
      role: Role.OWNER,
    });
    txMock.invite.update.mockResolvedValue({
      id: "invite-1",
      workspaceId: "workspace-1",
      email: "owner@example.com",
      role: Role.CONTRIBUTOR,
      token: "valid-token",
      expiresAt: new Date("2026-03-20T00:00:00.000Z"),
      acceptedAt: new Date("2026-03-12T00:00:00.000Z"),
      createdAt: new Date("2026-02-20T00:00:00.000Z"),
    });
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(txMock),
    );

    const { acceptInvite } = await import("@/lib/invites");

    const result = await acceptInvite(
      "user-owner",
      "owner@example.com",
      "valid-token",
    );

    expect(result.membership.role).toBe(Role.OWNER);
    expect(txMock.membership.create).not.toHaveBeenCalled();
    expect(txMock.invite.update).toHaveBeenCalledWith({
      where: { id: "invite-1" },
      data: { acceptedAt: expect.any(Date) },
    });
  });
});
