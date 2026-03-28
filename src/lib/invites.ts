import crypto from "node:crypto";
import type { Role } from "@/lib/domain-types";
import { ROLES } from "@/lib/domain-types";
import { prisma } from "@/lib/prisma";
import { canInvite } from "@/lib/rbac";
const VALID_INVITE_ROLES = new Set<string>([
  ROLES.OWNER,
  ROLES.ADMIN,
  ROLES.CONTRIBUTOR,
  ROLES.VIEWER,
]);

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class InviteAcceptanceError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "EXPIRED"
      | "ALREADY_ACCEPTED"
      | "FORBIDDEN_RECIPIENT",
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

  if (!actorMembership || !canInvite(actorMembership.role)) {
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

export async function acceptInvite(
  userId: string,
  userEmail: string,
  token: string,
) {
  const normalizedEmail = userEmail.trim().toLowerCase();
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

  if (invite.email.trim().toLowerCase() !== normalizedEmail) {
    throw new InviteAcceptanceError(
      "FORBIDDEN_RECIPIENT",
      "Invite is intended for a different email address",
    );
  }

  type PrismaTransaction = Parameters<
    Parameters<typeof prisma.$transaction>[0]
  >[0];
  return prisma.$transaction(async (tx: PrismaTransaction) => {
    const existingMembership = await tx.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId,
        },
      },
    });

    const membership = existingMembership
      ? existingMembership
      : await tx.membership.create({
          data: {
            workspaceId: invite.workspaceId,
            userId,
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
