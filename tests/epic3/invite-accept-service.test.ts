import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const txMock = {
  membership: {
    upsert: vi.fn(),
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
    txMock.membership.upsert.mockReset();
    txMock.invite.update.mockReset();
  });

  it("throws when invite token is not found", async () => {
    prismaMock.invite.findUnique.mockResolvedValue(null);

    const { acceptInvite } = await import("@/lib/invites");

    await expect(acceptInvite("user-1", "missing-token")).rejects.toThrow(
      "Invite token not found",
    );
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

    await expect(acceptInvite("user-1", "expired-token")).rejects.toThrow(
      "Invite has expired",
    );
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

    await expect(acceptInvite("user-1", "accepted-token")).rejects.toThrow(
      "Invite has already been accepted",
    );
  });

  it("creates or updates membership and marks invite accepted", async () => {
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

    txMock.membership.upsert.mockResolvedValue({
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

    const result = await acceptInvite("user-1", "valid-token");

    expect(result.membership.id).toBe("membership-1");
    expect(result.invite.id).toBe("invite-1");
    expect(txMock.membership.upsert).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: "workspace-1",
          userId: "user-1",
        },
      },
      create: {
        workspaceId: "workspace-1",
        userId: "user-1",
        role: Role.CONTRIBUTOR,
      },
      update: {
        role: Role.CONTRIBUTOR,
      },
    });
    expect(txMock.invite.update).toHaveBeenCalledWith({
      where: { id: "invite-1" },
      data: { acceptedAt: expect.any(Date) },
    });
  });
});
