import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

  if (!activeMembership) {
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

  const members: WorkspaceMemberSummary[] = memberships.map((membership) => ({
    id: membership.id,
    workspaceId: membership.workspaceId,
    userId: membership.userId,
    email: membership.user.email,
    role: membership.role,
    createdAt: membership.createdAt.toISOString(),
  }));

  return {
    activeRole: activeMembership.role,
    members,
  };
}
