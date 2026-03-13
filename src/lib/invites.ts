import { Role } from "@prisma/client";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const INVITE_ALLOWED_ROLES = new Set<Role>([Role.OWNER, Role.ADMIN]);
const VALID_INVITE_ROLES = new Set<string>([
  Role.OWNER,
  Role.ADMIN,
  Role.CONTRIBUTOR,
  Role.VIEWER,
]);

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class InviteAcceptanceError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "EXPIRED" | "ALREADY_ACCEPTED",
    message: string,
  ) {
    super(message);
    this.name = "InviteAcceptanceError";
  }
}

export function isValidInviteRole(value: string): value is Role {
  return VALID_INVITE_ROLES.has(value);
}

export async function createInvite(
  actorUserId: string,
  workspaceId: string,
  email: string,
  role: Role,
) {
  const actorMembership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId: actorUserId },
    },
  });

  if (!actorMembership || !INVITE_ALLOWED_ROLES.has(actorMembership.role)) {
    throw new Error("Only workspace Owners and Admins can invite members.");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  return prisma.invite.create({
    data: {
      workspaceId,
      email: email.trim().toLowerCase(),
      role,
      token,
      expiresAt,
    },
  });
}

export async function acceptInvite(userId: string, token: string) {
  const normalizedToken = token.trim();

  const invite = await prisma.invite.findUnique({
    where: { token: normalizedToken },
  });

  if (!invite) {
    throw new InviteAcceptanceError("NOT_FOUND", "Invite token not found");
  }

  if (invite.acceptedAt) {
    throw new InviteAcceptanceError(
      "ALREADY_ACCEPTED",
      "Invite has already been accepted",
    );
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    throw new InviteAcceptanceError("EXPIRED", "Invite has expired");
  }

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId,
        },
      },
      create: {
        workspaceId: invite.workspaceId,
        userId,
        role: invite.role,
      },
      update: {
        role: invite.role,
      },
    });

    const acceptedInvite = await tx.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    return {
      membership,
      invite: acceptedInvite,
    };
  });
}
