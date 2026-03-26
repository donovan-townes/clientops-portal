"use client";

import { useCallback, useState } from "react";

type Workspace = {
  id: string;
  name: string;
};

type WorkspaceListResponse = {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
};

type Task = {
  id: string;
  title: string;
  workspaceId: string;
  status: TaskStatus;
  assigneeUserId: string | null;
  dueAt: string | null;
};

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

type TasksResponse = {
  tasks: Task[];
  activeWorkspaceId: string;
};

type Deliverable = {
  id: string;
  workspaceId: string;
  taskId: string | null;
  filename: string;
  storageKey: string;
  uploadedByUserId: string;
  createdAt?: string;
};

type DeliverablesResponse = {
  deliverables: Deliverable[];
  activeWorkspaceId: string;
};

type DashboardSummary = {
  tasksTotal: number;
  tasksTodo: number;
  tasksInProgress: number;
  tasksDone: number;
  deliverablesTotal: number;
  membersTotal: number;
  activityEventsTotal: number;
};

type DashboardSummaryResponse = {
  activeWorkspaceId: string;
  summary: DashboardSummary;
};

type ActivityItem = {
  id: string;
  message: string;
};

type ActivityEvent = {
  id: string;
  workspaceId: string;
  actorUserId: string;
  actorEmail: string;
  type: string;
  payloadJson: unknown;
  createdAt: string;
};

type ActivityEventsResponse = {
  events: ActivityEvent[];
  activeWorkspaceId: string;
};

type Role = "OWNER" | "ADMIN" | "CONTRIBUTOR" | "VIEWER";

type Member = {
  id: string;
  workspaceId: string;
  userId: string;
  email: string;
  role: Role;
  createdAt: string;
};

type MembersResponse = {
  members: Member[];
  activeRole: Role;
  activeWorkspaceId: string;
};

type InviteResponse = {
  invite: {
    id: string;
    email: string;
    role: Role;
    token: string;
  };
};

type WorkspaceDashboardClientProps = {
  initialWorkspaces: Workspace[];
  initialActiveWorkspaceId: string | null;
  initialTasks: Task[];
  initialTasksContextWorkspaceId: string | null;
  initialSummary: DashboardSummary | null;
  initialSummaryContextWorkspaceId: string | null;
  initialDeliverables: Deliverable[];
  initialDeliverablesContextWorkspaceId: string | null;
  initialMembers: Member[];
  initialMembersContextWorkspaceId: string | null;
  initialActiveRole: Role | null;
  initialActivityEvents: ActivityEvent[];
  initialActivityEventsContextWorkspaceId: string | null;
};

export default function WorkspaceDashboardClient({
  initialWorkspaces,
  initialActiveWorkspaceId,
  initialTasks,
  initialTasksContextWorkspaceId,
  initialSummary,
  initialSummaryContextWorkspaceId,
  initialDeliverables,
  initialDeliverablesContextWorkspaceId,
  initialMembers,
  initialMembersContextWorkspaceId,
  initialActiveRole,
  initialActivityEvents,
  initialActivityEventsContextWorkspaceId,
}: WorkspaceDashboardClientProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    initialActiveWorkspaceId,
  );
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("CONTRIBUTOR");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [tasksContextWorkspaceId, setTasksContextWorkspaceId] = useState<
    string | null
  >(initialTasksContextWorkspaceId);
  const [summary, setSummary] = useState<DashboardSummary | null>(
    initialSummary,
  );
  const [summaryContextWorkspaceId, setSummaryContextWorkspaceId] = useState<
    string | null
  >(initialSummaryContextWorkspaceId);
  const [deliverables, setDeliverables] =
    useState<Deliverable[]>(initialDeliverables);
  const [deliverablesContextWorkspaceId, setDeliverablesContextWorkspaceId] =
    useState<string | null>(initialDeliverablesContextWorkspaceId);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [membersContextWorkspaceId, setMembersContextWorkspaceId] = useState<
    string | null
  >(initialMembersContextWorkspaceId);
  const [activeRole, setActiveRole] = useState<Role | null>(initialActiveRole);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>(
    initialActivityEvents,
  );
  const [
    activityEventsContextWorkspaceId,
    setActivityEventsContextWorkspaceId,
  ] = useState<string | null>(initialActivityEventsContextWorkspaceId);
  const [submitting, setSubmitting] = useState(false);
  const [tasksSubmitting, setTasksSubmitting] = useState(false);
  const [deliverablesSubmitting, setDeliverablesSubmitting] = useState(false);
  const [taskUpdatingId, setTaskUpdatingId] = useState<string | null>(null);
  const [taskDeletingId, setTaskDeletingId] = useState<string | null>(null);
  const [deliverableDeletingId, setDeliverableDeletingId] = useState<
    string | null
  >(null);
  const [deliverableFile, setDeliverableFile] = useState<File | null>(null);
  const [deliverableTaskId, setDeliverableTaskId] = useState("");
  const [taskTitleDrafts, setTaskTitleDrafts] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      initialTasks.map((task) => [task.id, task.title] as const),
    ),
  );
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>(() => {
    const initialWorkspaceName =
      initialWorkspaces.find(
        (workspace) => workspace.id === initialActiveWorkspaceId,
      )?.name ?? null;

    if (!initialWorkspaceName) {
      return [
        {
          id: `${Date.now()}-init`,
          message: "Context ready: no active workspace yet.",
        },
      ];
    }

    return [
      {
        id: `${Date.now()}-init`,
        message: `Context ready: ${initialWorkspaceName}`,
      },
    ];
  });

  const pushActivity = useCallback((message: string) => {
    setActivity((previous) =>
      [{ id: `${Date.now()}-${Math.random()}`, message }, ...previous].slice(
        0,
        5,
      ),
    );
  }, []);

  const refreshContext = async () => {
    const response = await fetch("/api/workspaces", { method: "GET" });
    const data = (await response.json()) as
      | WorkspaceListResponse
      | { error: string };

    if (!response.ok || "error" in data) {
      setError("Unable to load workspaces.");
      return;
    }

    setWorkspaces(data.workspaces);
    setActiveWorkspaceId(data.activeWorkspaceId);

    if (!data.activeWorkspaceId) {
      setTasks([]);
      setTasksContextWorkspaceId(null);
      setSummary(null);
      setSummaryContextWorkspaceId(null);
      setDeliverables([]);
      setDeliverablesContextWorkspaceId(null);
      setMembers([]);
      setMembersContextWorkspaceId(null);
      setActiveRole(null);
      setActivityEvents([]);
      setActivityEventsContextWorkspaceId(null);
    }

    const workspaceName = data.workspaces.find(
      (workspace) => workspace.id === data.activeWorkspaceId,
    )?.name;

    if (workspaceName) {
      pushActivity(`Workspace context synced: ${workspaceName}`);
    }
  };

  const handleCreateWorkspace = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newWorkspaceName }),
    });

    const data = (await response.json()) as
      | { workspace?: Workspace; error?: string }
      | { error: string };

    if (!response.ok || "error" in data) {
      setSubmitting(false);
      setError(data.error ?? "Unable to create workspace.");
      return;
    }

    setNewWorkspaceName("");
    setSubmitting(false);
    if (data.workspace?.name) {
      pushActivity(`Workspace created: ${data.workspace.name}`);
    }
    await refreshContext();
    await loadSummary("auto");
    await loadTasks("auto");
    await loadDeliverables("auto");
    await loadMembers("auto");
    await loadActivityEvents("auto");
  };

  const loadSummary = useCallback(
    async (mode: "manual" | "auto" = "manual") => {
      setError(null);

      const response = await fetch("/api/dashboard/summary", { method: "GET" });
      const data = (await response.json()) as
        | DashboardSummaryResponse
        | { error: string };

      if (!response.ok || "error" in data) {
        const message =
          "error" in data ? data.error : "Unable to load dashboard summary.";
        setError(message);
        return;
      }

      setSummary(data.summary);
      setSummaryContextWorkspaceId(data.activeWorkspaceId);

      if (mode === "manual") {
        pushActivity(`Summary loaded for workspace ${data.activeWorkspaceId}`);
        return;
      }

      pushActivity(
        `Summary auto-synced for workspace ${data.activeWorkspaceId}`,
      );
    },
    [pushActivity],
  );

  const loadTasks = useCallback(
    async (mode: "manual" | "auto" = "manual") => {
      setError(null);

      const response = await fetch("/api/tasks", { method: "GET" });
      const data = (await response.json()) as TasksResponse | { error: string };

      if (!response.ok || "error" in data) {
        const message = "error" in data ? data.error : "Unable to load tasks.";
        setError(message);
        return;
      }

      setTasks(data.tasks);
      setTaskTitleDrafts(
        Object.fromEntries(
          data.tasks.map((task) => [task.id, task.title] as const),
        ),
      );
      setTasksContextWorkspaceId(data.activeWorkspaceId);
      if (mode === "manual") {
        pushActivity(
          `Tasks loaded for workspace ${data.activeWorkspaceId} (${data.tasks.length})`,
        );
        return;
      }

      pushActivity(
        `Tasks auto-synced for workspace ${data.activeWorkspaceId} (${data.tasks.length})`,
      );
    },
    [pushActivity],
  );

  const loadMembers = useCallback(
    async (mode: "manual" | "auto" = "manual") => {
      setError(null);

      const response = await fetch("/api/members", { method: "GET" });
      const data = (await response.json()) as
        | MembersResponse
        | { error: string };

      if (!response.ok || "error" in data) {
        const message =
          "error" in data ? data.error : "Unable to load workspace members.";
        setError(message);
        return;
      }

      setMembers(data.members);
      setMembersContextWorkspaceId(data.activeWorkspaceId);
      setActiveRole(data.activeRole);

      if (mode === "manual") {
        pushActivity(
          `Members loaded for workspace ${data.activeWorkspaceId} (${data.members.length})`,
        );
        return;
      }

      pushActivity(
        `Members auto-synced for workspace ${data.activeWorkspaceId} (${data.members.length})`,
      );
    },
    [pushActivity],
  );

  const loadDeliverables = useCallback(
    async (mode: "manual" | "auto" = "manual") => {
      setError(null);

      const response = await fetch("/api/deliverables", { method: "GET" });
      const data = (await response.json()) as
        | DeliverablesResponse
        | { error: string };

      if (!response.ok || "error" in data) {
        const message =
          "error" in data ? data.error : "Unable to load deliverables.";
        setError(message);
        return;
      }

      setDeliverables(data.deliverables);
      setDeliverablesContextWorkspaceId(data.activeWorkspaceId);

      if (mode === "manual") {
        pushActivity(
          `Deliverables loaded for workspace ${data.activeWorkspaceId} (${data.deliverables.length})`,
        );
        return;
      }

      pushActivity(
        `Deliverables auto-synced for workspace ${data.activeWorkspaceId} (${data.deliverables.length})`,
      );
    },
    [pushActivity],
  );

  const loadActivityEvents = useCallback(
    async (mode: "manual" | "auto" = "manual") => {
      setError(null);

      const response = await fetch("/api/activity", { method: "GET" });
      const data = (await response.json()) as
        | ActivityEventsResponse
        | { error: string };

      if (!response.ok || "error" in data) {
        const message =
          "error" in data ? data.error : "Unable to load activity.";
        setError(message);
        return;
      }

      setActivityEvents(data.events);
      setActivityEventsContextWorkspaceId(data.activeWorkspaceId);

      if (mode === "manual") {
        pushActivity(
          `Activity loaded for workspace ${data.activeWorkspaceId} (${data.events.length})`,
        );
        return;
      }

      pushActivity(
        `Activity auto-synced for workspace ${data.activeWorkspaceId} (${data.events.length})`,
      );
    },
    [pushActivity],
  );

  const handleCreateTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTasksSubmitting(true);
    setError(null);

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTaskTitle }),
    });

    const data = (await response.json()) as
      | { task?: Task; activeWorkspaceId?: string; error?: string }
      | { error: string };

    if (!response.ok || "error" in data) {
      const message = "error" in data ? data.error : data.error;
      setTasksSubmitting(false);
      setError(message ?? "Unable to create task.");
      return;
    }

    setNewTaskTitle("");
    setTasksSubmitting(false);
    if (data.task?.title && data.activeWorkspaceId) {
      pushActivity(
        `Task created in ${data.activeWorkspaceId}: ${data.task.title}`,
      );
    }
    await loadTasks();
  };

  const handleUploadDeliverable = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError(null);

    if (!deliverableFile) {
      setError("File is required");
      return;
    }

    setDeliverablesSubmitting(true);

    const formData = new FormData();
    formData.set("file", deliverableFile);

    if (deliverableTaskId.trim()) {
      formData.set("taskId", deliverableTaskId.trim());
    }

    const response = await fetch("/api/deliverables", {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as
      | {
          deliverable?: Deliverable;
          activeWorkspaceId?: string;
          error?: string;
        }
      | { error: string };

    setDeliverablesSubmitting(false);

    if (!response.ok || "error" in data) {
      const message =
        "error" in data
          ? (data.error ?? "Unable to upload deliverable.")
          : "Unable to upload deliverable.";
      setError(message);
      pushActivity(`Deliverable upload failed: ${message}`);
      return;
    }

    setDeliverableFile(null);
    setDeliverableTaskId("");
    pushActivity(
      `Deliverable uploaded in ${data.activeWorkspaceId ?? "workspace"}: ${data.deliverable?.filename ?? "file"}`,
    );
    await loadDeliverables("auto");
  };

  const handleDeleteDeliverable = async (deliverable: Deliverable) => {
    setDeliverableDeletingId(deliverable.id);
    setError(null);

    const response = await fetch(`/api/deliverables/${deliverable.id}`, {
      method: "DELETE",
    });

    const data = (await response.json()) as
      | {
          deletedDeliverableId?: string;
          activeWorkspaceId?: string;
          error?: string;
        }
      | { error: string };

    setDeliverableDeletingId(null);

    if (!response.ok || "error" in data) {
      const message =
        "error" in data
          ? (data.error ?? "Unable to delete deliverable.")
          : "Unable to delete deliverable.";
      setError(message);
      pushActivity(`Deliverable delete failed: ${message}`);
      return;
    }

    setDeliverables((previous) =>
      previous.filter((item) => item.id !== deliverable.id),
    );
    pushActivity(
      `Deliverable deleted in ${deliverable.workspaceId}: ${deliverable.filename}`,
    );
    await loadDeliverables("auto");
  };

  const handleUpdateTask = async (
    taskId: string,
    payload: {
      title?: string;
      status?: TaskStatus;
    },
    activityMessage: string,
  ) => {
    setTaskUpdatingId(taskId);
    setError(null);

    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as
      | { task?: Task; activeWorkspaceId?: string; error?: string }
      | { error: string };

    setTaskUpdatingId(null);

    if (!response.ok || "error" in data) {
      const message =
        "error" in data
          ? (data.error ?? "Unable to update task.")
          : "Unable to update task.";
      setError(message);
      pushActivity(`Task update failed: ${message}`);
      return;
    }

    pushActivity(activityMessage);
    await loadTasks("auto");
  };

  const handleSaveTaskTitle = async (task: Task) => {
    const draftTitle = taskTitleDrafts[task.id] ?? task.title;

    if (!draftTitle.trim()) {
      setError("Task title is required");
      return;
    }

    if (draftTitle.trim() === task.title) {
      return;
    }

    await handleUpdateTask(
      task.id,
      { title: draftTitle },
      `Task updated in ${task.workspaceId}: ${draftTitle.trim()}`,
    );
  };

  const handleTaskStatusChange = async (task: Task, nextStatus: TaskStatus) => {
    if (task.status === nextStatus) {
      return;
    }

    await handleUpdateTask(
      task.id,
      { status: nextStatus },
      `Task status changed in ${task.workspaceId}: ${task.title} (${task.status} → ${nextStatus})`,
    );
  };

  const handleDeleteTask = async (task: Task) => {
    setTaskDeletingId(task.id);
    setError(null);

    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "DELETE",
    });

    const data = (await response.json()) as
      | { deletedTaskId?: string; activeWorkspaceId?: string; error?: string }
      | { error: string };

    setTaskDeletingId(null);

    if (!response.ok || "error" in data) {
      const message =
        "error" in data
          ? (data.error ?? "Unable to delete task.")
          : "Unable to delete task.";
      setError(message);
      pushActivity(`Task delete failed: ${message}`);
      return;
    }

    setTasks((previous) => previous.filter((t) => t.id !== task.id));
    setTaskTitleDrafts((previous) => {
      const next = { ...previous };
      delete next[task.id];
      return next;
    });
    pushActivity(`Task deleted in ${task.workspaceId}: ${task.title}`);
    await loadTasks("auto");
  };

  const handleCreateInvite = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError(null);
    setInviteMessage(null);
    setInviteLink(null);

    if (!activeWorkspaceId) {
      setError("No active workspace. Create a workspace first.");
      return;
    }

    setInviteSubmitting(true);

    const response = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: activeWorkspaceId,
        email: inviteEmail,
        role: inviteRole,
      }),
    });

    const data = (await response.json()) as InviteResponse | { error: string };

    if (!response.ok) {
      const message = "error" in data ? data.error : "Unable to create invite.";
      setInviteSubmitting(false);
      setError(message);
      return;
    }

    if ("error" in data) {
      setInviteSubmitting(false);
      setError(data.error);
      return;
    }

    setInviteSubmitting(false);
    setInviteEmail("");
    setInviteMessage(
      `Invite created for ${data.invite.email} (${data.invite.role}). Token: ${data.invite.token}`,
    );
    setInviteLink(`/invite/${data.invite.token}`);
    pushActivity(
      `Invite created for ${data.invite.email} as ${data.invite.role} in ${activeWorkspaceId}`,
    );
    await loadMembers("auto");
  };

  const handleSwitchWorkspace = async (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const targetWorkspaceId = event.target.value;

    if (!targetWorkspaceId) return;

    setError(null);

    const response = await fetch("/api/workspaces/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: targetWorkspaceId }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Unable to switch workspace.");
      return;
    }

    const workspaceName =
      workspaces.find((workspace) => workspace.id === targetWorkspaceId)
        ?.name ?? targetWorkspaceId;
    pushActivity(`Workspace switched: ${workspaceName}`);

    await refreshContext();
    await loadSummary("auto");
    await loadTasks("auto");
    await loadDeliverables("auto");
    await loadMembers("auto");
    await loadActivityEvents("auto");
  };

  const activeWorkspaceName =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name ??
    null;
  const canInvite = activeRole === "OWNER" || activeRole === "ADMIN";
  const canEditTasks =
    activeRole === "OWNER" ||
    activeRole === "ADMIN" ||
    activeRole === "CONTRIBUTOR";
  const canDeleteTasks = activeRole === "OWNER" || activeRole === "ADMIN";
  const canUploadDeliverables =
    activeRole === "OWNER" ||
    activeRole === "ADMIN" ||
    activeRole === "CONTRIBUTOR";
  const canDeleteDeliverables =
    activeRole === "OWNER" || activeRole === "ADMIN";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900/40 dark:bg-cyan-950/20">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-cyan-900 dark:text-cyan-200">
            Activity (Read-Only)
          </h2>
          <span className="text-xs text-cyan-700 dark:text-cyan-300">
            Session notifications
          </span>
        </div>
        <div className="mt-3 space-y-1">
          {activity.map((item) => (
            <p
              key={item.id}
              className="text-xs text-cyan-800 dark:text-cyan-200"
            >
              • {item.message}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Active Workspace
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {activeWorkspaceName
            ? `Current context: ${activeWorkspaceName}`
            : "No active workspace selected yet."}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Current role: {activeRole ?? "Unknown"}
        </p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Summary (Scoped)
          </h2>
          <button
            type="button"
            onClick={() => {
              void loadSummary("manual");
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Load Summary
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {summaryContextWorkspaceId
            ? `API scoped to workspace: ${summaryContextWorkspaceId}`
            : "Load summary to verify active workspace dashboard scope."}
        </p>

        {!summary ? (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            No summary loaded yet.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">Tasks</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {summary.tasksTotal}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">TODO</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {summary.tasksTodo}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                IN_PROGRESS
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {summary.tasksInProgress}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">DONE</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {summary.tasksDone}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Deliverables
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {summary.deliverablesTotal}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Members
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {summary.membersTotal}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Activity Events
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {summary.activityEventsTotal}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Switch Workspace
        </h2>
        <select
          value={activeWorkspaceId ?? ""}
          onChange={handleSwitchWorkspace}
          className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          <option value="" disabled>
            Select workspace
          </option>
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Create Workspace
        </h2>
        <form
          onSubmit={handleCreateWorkspace}
          className="mt-3 flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={newWorkspaceName}
            onChange={(event) => setNewWorkspaceName(event.target.value)}
            placeholder="Workspace name"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Members (Scoped)
          </h2>
          <button
            type="button"
            onClick={() => {
              void loadMembers("manual");
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Load Members
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {membersContextWorkspaceId
            ? `API scoped to workspace: ${membersContextWorkspaceId}`
            : "Load members to verify workspace membership scope."}
        </p>

        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {activeRole === "OWNER" || activeRole === "ADMIN"
            ? "Invite actions available (Owner/Admin)."
            : "Invite actions restricted to Owners/Admins."}
        </p>

        <div className="mt-4 space-y-2">
          {members.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No members loaded yet.
            </p>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
              >
                <p className="font-medium text-gray-900 dark:text-white">
                  {member.email}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  role: {member.role}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section id="invite" className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Invite Member
        </h2>

        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {canInvite
            ? "Owner/Admin can issue invite tokens from the active workspace context."
            : "Invite creation is restricted to Owners/Admins."}
        </p>

        <form
          onSubmit={handleCreateInvite}
          className="mt-4 flex flex-col gap-3 lg:flex-row"
        >
          <input
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="member@company.com"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />

          <select
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value as Role)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white lg:w-52"
          >
            <option value="OWNER">OWNER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="CONTRIBUTOR">CONTRIBUTOR</option>
            <option value="VIEWER">VIEWER</option>
          </select>

          <button
            type="submit"
            disabled={inviteSubmitting || !canInvite}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {inviteSubmitting ? "Inviting..." : "Create Invite"}
          </button>
        </form>

        {inviteMessage ? (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              {inviteMessage}
            </p>
            {inviteLink ? (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Share this acceptance link with the invited user: {inviteLink}
              </p>
            ) : null}
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Invited user flow: open the link, sign in, then click Accept
              invite.
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tasks (Scoped)
          </h2>
          <button
            type="button"
            onClick={() => {
              void loadTasks("manual");
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Load Tasks
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {tasksContextWorkspaceId
            ? `API scoped to workspace: ${tasksContextWorkspaceId}`
            : "Load tasks to verify active workspace scoping."}
        </p>

        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {canDeleteTasks
            ? "Task lifecycle controls available (Owner/Admin/Contributor edit, Owner/Admin delete)."
            : canEditTasks
              ? "Task edit/status controls available. Delete is restricted to Owners/Admins."
              : "Task lifecycle controls restricted by role."}
        </p>

        <form
          onSubmit={handleCreateTask}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={newTaskTitle}
            onChange={(event) => setNewTaskTitle(event.target.value)}
            placeholder="New task title"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <button
            type="submit"
            disabled={tasksSubmitting}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-60"
          >
            {tasksSubmitting ? "Creating..." : "Create Task"}
          </button>
        </form>

        <div className="mt-4 space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No tasks loaded yet.
            </p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
              >
                <div className="flex flex-col gap-2">
                  <input
                    value={taskTitleDrafts[task.id] ?? task.title}
                    onChange={(event) =>
                      setTaskTitleDrafts((previous) => ({
                        ...previous,
                        [task.id]: event.target.value,
                      }))
                    }
                    disabled={!canEditTasks || taskUpdatingId === task.id}
                    className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      value={task.status}
                      onChange={(event) => {
                        void handleTaskStatusChange(
                          task,
                          event.target.value as TaskStatus,
                        );
                      }}
                      disabled={!canEditTasks || taskUpdatingId === task.id}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-white sm:w-44"
                    >
                      <option value="TODO">TODO</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="DONE">DONE</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        void handleSaveTaskTitle(task);
                      }}
                      disabled={!canEditTasks || taskUpdatingId === task.id}
                      className="rounded-lg border border-cyan-300 px-3 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 disabled:opacity-60 dark:border-cyan-900/50 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                    >
                      {taskUpdatingId === task.id ? "Saving..." : "Save"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteTask(task);
                      }}
                      disabled={taskDeletingId === task.id}
                      className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      {taskDeletingId === task.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    status: {task.status} · workspaceId: {task.workspaceId}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Deliverables (Scoped)
          </h2>
          <button
            type="button"
            onClick={() => {
              void loadDeliverables("manual");
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Load Deliverables
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {deliverablesContextWorkspaceId
            ? `API scoped to workspace: ${deliverablesContextWorkspaceId}`
            : "Load deliverables to verify active workspace scoping."}
        </p>

        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {canDeleteDeliverables
            ? "Deliverable controls available (Owner/Admin delete, Owner/Admin/Contributor upload)."
            : canUploadDeliverables
              ? "Deliverable upload available. Delete is restricted to Owners/Admins."
              : "Deliverable controls restricted by role."}
        </p>

        <form
          onSubmit={handleUploadDeliverable}
          className="mt-4 flex flex-col gap-3"
        >
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt,.md,.docx"
            onChange={(event) =>
              setDeliverableFile(event.target.files?.[0] ?? null)
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-cyan-50 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-cyan-700 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />

          <select
            value={deliverableTaskId}
            onChange={(event) => setDeliverableTaskId(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="">Attach to no task</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={deliverablesSubmitting || !canUploadDeliverables}
            className="self-start rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-60"
          >
            {deliverablesSubmitting ? "Uploading..." : "Upload Deliverable"}
          </button>
        </form>

        <div className="mt-4 space-y-2">
          {deliverables.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No deliverables loaded yet.
            </p>
          ) : (
            deliverables.map((deliverable) => (
              <div
                key={deliverable.id}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {deliverable.filename}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      taskId: {deliverable.taskId ?? "none"} · workspaceId:{" "}
                      {deliverable.workspaceId}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteDeliverable(deliverable);
                    }}
                    disabled={
                      !canDeleteDeliverables ||
                      deliverableDeletingId === deliverable.id
                    }
                    className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/30"
                  >
                    {deliverableDeletingId === deliverable.id
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Activity Feed (Scoped)
          </h2>
          <button
            type="button"
            onClick={() => {
              void loadActivityEvents("manual");
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Load Activity
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {activityEventsContextWorkspaceId
            ? `API scoped to workspace: ${activityEventsContextWorkspaceId}`
            : "Load activity to verify workspace audit log scope."}
        </p>

        <div className="mt-4 space-y-2">
          {activityEvents.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No activity events loaded yet.
            </p>
          ) : (
            activityEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
              >
                <p className="font-medium text-gray-900 dark:text-white">
                  {event.type}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {event.actorEmail} &middot;{" "}
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
