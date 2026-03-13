import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import WorkspaceDashboardClient from "@/components/workspace-dashboard-client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_WORKSPACE_COOKIE_NAME } from "@/lib/workspace-context";
import { resolveActiveWorkspaceForUser } from "@/lib/workspaces";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const candidateWorkspaceId = cookieStore.get(
    ACTIVE_WORKSPACE_COOKIE_NAME,
  )?.value;

  const context = await resolveActiveWorkspaceForUser(
    session.user.id,
    candidateWorkspaceId,
  );

  const initialTasks = context.activeWorkspace
    ? await prisma.task.findMany({
        where: { workspaceId: context.activeWorkspace.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const initialMembers = context.activeWorkspace
    ? await prisma.membership.findMany({
        where: { workspaceId: context.activeWorkspace.id },
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const initialActiveMembership = context.activeWorkspace
    ? await prisma.membership.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: context.activeWorkspace.id,
            userId: session.user.id,
          },
        },
      })
    : null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Workspace Dashboard
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage your workspace context for tenant-scoped operations.
        </p>
      </div>

      <div className="mt-8">
        <WorkspaceDashboardClient
          initialWorkspaces={context.workspaces}
          initialActiveWorkspaceId={context.activeWorkspace?.id ?? null}
          initialTasks={initialTasks}
          initialTasksContextWorkspaceId={context.activeWorkspace?.id ?? null}
          initialMembers={initialMembers.map((membership) => ({
            id: membership.id,
            workspaceId: membership.workspaceId,
            userId: membership.userId,
            email: membership.user.email,
            role: membership.role,
            createdAt: membership.createdAt.toISOString(),
          }))}
          initialMembersContextWorkspaceId={context.activeWorkspace?.id ?? null}
          initialActiveRole={initialActiveMembership?.role ?? null}
        />
      </div>
    </main>
  );
}
