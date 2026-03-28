import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type {
  ActivityEvent as PrismaActivityEvent,
  Deliverable as PrismaDeliverable,
  Membership as PrismaMembership,
  Task as PrismaTask,
} from "@prisma/client";
import WorkspaceDashboardClient from "@/components/workspace-dashboard-client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_WORKSPACE_COOKIE_NAME } from "@/lib/workspace-context";
import { resolveActiveWorkspaceForUser } from "@/lib/workspaces";

type DashboardSummary = {
  tasksTotal: number;
  tasksTodo: number;
  tasksInProgress: number;
  tasksDone: number;
  deliverablesTotal: number;
  membersTotal: number;
  activityEventsTotal: number;
};

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

  const initialTasks: PrismaTask[] = context.activeWorkspace
    ? await prisma.task.findMany({
        where: { workspaceId: context.activeWorkspace.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  let initialSummary: DashboardSummary | null = null;

  if (context.activeWorkspace) {
    const [
      tasksTotal,
      tasksTodo,
      tasksInProgress,
      tasksDone,
      deliverablesTotal,
      membersTotal,
      activityEventsTotal,
    ] = await Promise.all([
      prisma.task.count({ where: { workspaceId: context.activeWorkspace.id } }),
      prisma.task.count({
        where: {
          workspaceId: context.activeWorkspace.id,
          status: "TODO",
        },
      }),
      prisma.task.count({
        where: {
          workspaceId: context.activeWorkspace.id,
          status: "IN_PROGRESS",
        },
      }),
      prisma.task.count({
        where: {
          workspaceId: context.activeWorkspace.id,
          status: "DONE",
        },
      }),
      prisma.deliverable.count({
        where: { workspaceId: context.activeWorkspace.id },
      }),
      prisma.membership.count({
        where: { workspaceId: context.activeWorkspace.id },
      }),
      prisma.activityEvent.count({
        where: { workspaceId: context.activeWorkspace.id },
      }),
    ]);

    initialSummary = {
      tasksTotal,
      tasksTodo,
      tasksInProgress,
      tasksDone,
      deliverablesTotal,
      membersTotal,
      activityEventsTotal,
    };
  }

  const initialDeliverables: PrismaDeliverable[] = context.activeWorkspace
    ? await prisma.deliverable.findMany({
        where: { workspaceId: context.activeWorkspace.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const initialActivityEvents: Array<
    PrismaActivityEvent & { actor: { email: string } }
  > = context.activeWorkspace
    ? await prisma.activityEvent.findMany({
        where: { workspaceId: context.activeWorkspace.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: { select: { email: true } } },
      })
    : [];

  const initialMembers: Array<PrismaMembership & { user: { email: string } }> =
    context.activeWorkspace
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
    <WorkspaceDashboardClient
      initialWorkspaces={context.workspaces}
      initialActiveWorkspaceId={context.activeWorkspace?.id ?? null}
      initialTasks={initialTasks.map((task: PrismaTask) => ({
        ...task,
        dueAt: task.dueAt ? task.dueAt.toISOString() : null,
      }))}
      initialTasksContextWorkspaceId={context.activeWorkspace?.id ?? null}
      initialSummary={initialSummary}
      initialSummaryContextWorkspaceId={context.activeWorkspace?.id ?? null}
      initialDeliverables={initialDeliverables.map((deliverable: PrismaDeliverable) => ({
        ...deliverable,
        createdAt: deliverable.createdAt.toISOString(),
      }))}
      initialDeliverablesContextWorkspaceId={
        context.activeWorkspace?.id ?? null
      }
      initialMembers={initialMembers.map((membership: PrismaMembership & { user: { email: string } }) => ({
        id: membership.id,
        workspaceId: membership.workspaceId,
        userId: membership.userId,
        email: membership.user.email,
        role: membership.role,
        createdAt: membership.createdAt.toISOString(),
      }))}
      initialMembersContextWorkspaceId={context.activeWorkspace?.id ?? null}
      initialActiveRole={initialActiveMembership?.role ?? null}
      initialActivityEvents={initialActivityEvents.map((event: PrismaActivityEvent & { actor: { email: string } }) => ({
        id: event.id,
        workspaceId: event.workspaceId,
        actorUserId: event.actorUserId,
        actorEmail: event.actor.email,
        type: event.type,
        payloadJson: event.payloadJson,
        createdAt: event.createdAt.toISOString(),
      }))}
      initialActivityEventsContextWorkspaceId={
        context.activeWorkspace?.id ?? null
      }
      fileUploadsEnabled={process.env.ENABLE_FILE_UPLOADS !== "false"}
    />
  );
}
