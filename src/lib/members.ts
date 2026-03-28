import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/domain-types";
import { canViewMembers } from "@/lib/rbac";

export type WorkspaceMemberSummary = {
  id: string;
  workspaceId: string;
  userId: string;
  email: string;
  role: Role;
  createdAt: string;
};

export async function listMembersForWorkspace(
  userId: string,
  workspaceId: string,
) {
  const activeMembership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!activeMembership || !canViewMembers(activeMembership.role)) {
    throw new Error("Workspace access denied.");
  }

  const memberships = await prisma.membership.findMany({
    where: {
      workspaceId,
    },
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const members: WorkspaceMemberSummary[] = memberships.map(
    (membership: (typeof memberships)[number]) => ({
      id: membership.id,
      workspaceId: membership.workspaceId,
      userId: membership.userId,
      email: membership.user.email,
      role: membership.role,
      createdAt: membership.createdAt.toISOString(),
    }),
  );

  return {
    activeRole: activeMembership.role,
    members,
  };
}
