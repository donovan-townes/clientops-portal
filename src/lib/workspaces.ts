import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type WorkspaceSummary = {
  id: string;
  name: string;
};

export type WorkspaceContextResolution = {
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  shouldPersistActiveWorkspace: boolean;
};

export async function createWorkspaceForUser(userId: string, name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Workspace name is required.");
  }

  return prisma.workspace.create({
    data: {
      name: trimmedName,
      memberships: {
        create: {
          userId,
          role: Role.OWNER,
        },
      },
    },
    include: {
      memberships: true,
    },
  });
}

export async function listWorkspacesForUser(userId: string) {
  return prisma.workspace.findMany({
    where: {
      memberships: {
        some: {
          userId,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function assertWorkspaceAccessForUser(
  userId: string,
  workspaceId: string,
) {
  const membership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new Error("Workspace access denied.");
  }

  return membership;
}

export async function resolveActiveWorkspaceForUser(
  userId: string,
  candidateWorkspaceId?: string,
): Promise<WorkspaceContextResolution> {
  const workspaces = await listWorkspacesForUser(userId);

  if (workspaces.length === 0) {
    return {
      workspaces,
      activeWorkspace: null,
      shouldPersistActiveWorkspace: false,
    };
  }

  if (candidateWorkspaceId) {
    const cookieWorkspace = workspaces.find(
      (workspace) => workspace.id === candidateWorkspaceId,
    );

    if (cookieWorkspace) {
      return {
        workspaces,
        activeWorkspace: cookieWorkspace,
        shouldPersistActiveWorkspace: false,
      };
    }
  }

  return {
    workspaces,
    activeWorkspace: workspaces[0],
    shouldPersistActiveWorkspace: true,
  };
}
