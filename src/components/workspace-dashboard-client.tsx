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
  const [, setTasksContextWorkspaceId] = useState<string | null>(
    initialTasksContextWorkspaceId,
  );
  const [summary, setSummary] = useState<DashboardSummary | null>(
    initialSummary,
  );
  const [, setSummaryContextWorkspaceId] = useState<string | null>(
    initialSummaryContextWorkspaceId,
  );
  const [deliverables, setDeliverables] =
    useState<Deliverable[]>(initialDeliverables);
  const [, setDeliverablesContextWorkspaceId] = useState<string | null>(
    initialDeliverablesContextWorkspaceId,
  );
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [, setMembersContextWorkspaceId] = useState<string | null>(
    initialMembersContextWorkspaceId,
  );
  const [activeRole, setActiveRole] = useState<Role | null>(initialActiveRole);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>(
    initialActivityEvents,
  );
  const [, setActivityEventsContextWorkspaceId] = useState<string | null>(
    initialActivityEventsContextWorkspaceId,
  );
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
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
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
    setShowCreateWorkspace(false);
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
      `Task status changed in ${task.workspaceId}: ${task.title} (${task.status} â†’ ${nextStatus})`,
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

  const roleBadgeClass = (role: Role): string => {
    const base = "rounded-full px-2 py-0.5 text-xs font-semibold";
    if (role === "OWNER")
      return `${base} bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300`;
    if (role === "ADMIN")
      return `${base} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`;
    if (role === "CONTRIBUTOR")
      return `${base} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300`;
    return `${base} bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300`;
  };

  const taskStatusBadgeClass = (status: TaskStatus): string => {
    if (status === "TODO")
      return "rounded-full px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
    if (status === "IN_PROGRESS")
      return "rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    return "rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-950">
      {/* Session notification strip */}
      <div className="border-b border-cyan-200/60 bg-cyan-50 px-4 py-2 dark:border-cyan-900/30 dark:bg-cyan-950/20">
        <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto">
          <span className="shrink-0 text-xs font-semibold text-cyan-700 dark:text-cyan-400">
            Session:
          </span>
          <div className="flex items-center gap-4">
            {activity.slice(0, 3).map((item) => (
              <p
                key={item.id}
                className="shrink-0 text-xs text-cyan-700 dark:text-cyan-300"
              >
                {item.message}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header & workspace control bar */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Workspace Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Tenant-scoped operations &amp; client management.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex items-center gap-2">
              {activeWorkspaceName ? (
                <>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {activeWorkspaceName}
                  </span>
                  {activeRole ? (
                    <span className={roleBadgeClass(activeRole)}>
                      {activeRole}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-sm text-gray-400 dark:text-gray-500">
                  No workspace selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {workspaces.length > 0 ? (
                <select
                  value={activeWorkspaceId ?? ""}
                  onChange={handleSwitchWorkspace}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="" disabled>
                    Switch workspace
                  </option>
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                onClick={() => setShowCreateWorkspace((v) => !v)}
                className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-white"
              >
                {showCreateWorkspace ? "Cancel" : "+ New Workspace"}
              </button>
            </div>

            {showCreateWorkspace ? (
              <form
                onSubmit={handleCreateWorkspace}
                className="flex items-center gap-2"
              >
                <input
                  value={newWorkspaceName}
                  onChange={(event) => setNewWorkspaceName(event.target.value)}
                  placeholder="Workspace name"
                  autoFocus
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {submitting ? "Creatingâ€¦" : "Create"}
                </button>
              </form>
            ) : null}
          </div>
        </div>

        {/* Error banner */}
        {error ? (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        ) : null}

        {/* KPI Summary bar */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Workspace Overview
            </h2>
            <button
              type="button"
              onClick={() => {
                void loadSummary("manual");
              }}
              className="text-xs text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
            >
              â†» Refresh
            </button>
          </div>
          {!summary ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {activeWorkspaceId
                ? "Loading overviewâ€¦"
                : "Select or create a workspace to see the overview."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30">
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  Tasks
                </p>
                <p className="mt-1 text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {summary.tasksTotal}
                </p>
              </div>
              <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800/40">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  To Do
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {summary.tasksTodo}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  In Progress
                </p>
                <p className="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-100">
                  {summary.tasksInProgress}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Done
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  {summary.tasksDone}
                </p>
              </div>
              <div className="rounded-lg bg-violet-50 p-3 dark:bg-violet-950/30">
                <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
                  Files
                </p>
                <p className="mt-1 text-2xl font-bold text-violet-900 dark:text-violet-100">
                  {summary.deliverablesTotal}
                </p>
              </div>
              <div className="rounded-lg bg-teal-50 p-3 dark:bg-teal-950/30">
                <p className="text-xs font-medium text-teal-600 dark:text-teal-400">
                  Members
                </p>
                <p className="mt-1 text-2xl font-bold text-teal-900 dark:text-teal-100">
                  {summary.membersTotal}
                </p>
              </div>
              <div className="rounded-lg bg-cyan-50 p-3 dark:bg-cyan-950/30">
                <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
                  Events
                </p>
                <p className="mt-1 text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                  {summary.activityEventsTotal}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Main 2-column layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Primary column â€” Tasks + Deliverables */}
          <div className="space-y-6 lg:col-span-2">
            {/* Tasks */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Tasks
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    void loadTasks("manual");
                  }}
                  className="text-xs text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  â†» Refresh
                </button>
              </div>

              {canEditTasks ? (
                <form onSubmit={handleCreateTask} className="mt-4 flex gap-2">
                  <input
                    value={newTaskTitle}
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                    placeholder="New task titleâ€¦"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={tasksSubmitting}
                    className="shrink-0 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-60"
                  >
                    {tasksSubmitting ? "Addingâ€¦" : "Add"}
                  </button>
                </form>
              ) : (
                <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                  Task creation requires Contributor or higher.
                </p>
              )}

              <div className="mt-4 space-y-2">
                {tasks.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                    No tasks yet.{canEditTasks ? " Add one above." : ""}
                  </p>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-3 dark:border-gray-800 dark:bg-gray-800/40"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          value={taskTitleDrafts[task.id] ?? task.title}
                          onChange={(event) =>
                            setTaskTitleDrafts((previous) => ({
                              ...previous,
                              [task.id]: event.target.value,
                            }))
                          }
                          disabled={
                            !canEditTasks || taskUpdatingId === task.id
                          }
                          className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                        <div className="flex shrink-0 items-center gap-1.5">
                          <select
                            value={task.status}
                            onChange={(event) => {
                              void handleTaskStatusChange(
                                task,
                                event.target.value as TaskStatus,
                              );
                            }}
                            disabled={
                              !canEditTasks || taskUpdatingId === task.id
                            }
                            className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          >
                            <option value="TODO">To Do</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="DONE">Done</option>
                          </select>
                          {canEditTasks ? (
                            <button
                              type="button"
                              onClick={() => {
                                void handleSaveTaskTitle(task);
                              }}
                              disabled={taskUpdatingId === task.id}
                              className="rounded-md border border-cyan-200 px-2.5 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50 disabled:opacity-60 dark:border-cyan-900/40 dark:text-cyan-400 dark:hover:bg-cyan-950/30"
                            >
                              {taskUpdatingId === task.id ? "â€¦" : "Save"}
                            </button>
                          ) : null}
                          {canDeleteTasks ? (
                            <button
                              type="button"
                              onClick={() => {
                                void handleDeleteTask(task);
                              }}
                              disabled={taskDeletingId === task.id}
                              className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30"
                            >
                              {taskDeletingId === task.id ? "â€¦" : "Delete"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className={taskStatusBadgeClass(task.status)}>
                          {task.status === "IN_PROGRESS"
                            ? "In Progress"
                            : task.status === "TODO"
                              ? "To Do"
                              : "Done"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Deliverables */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Deliverables
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    void loadDeliverables("manual");
                  }}
                  className="text-xs text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  â†» Refresh
                </button>
              </div>

              {canUploadDeliverables ? (
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
                  <div className="flex gap-2">
                    <select
                      value={deliverableTaskId}
                      onChange={(event) =>
                        setDeliverableTaskId(event.target.value)
                      }
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
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
                      disabled={deliverablesSubmitting}
                      className="shrink-0 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-60"
                    >
                      {deliverablesSubmitting ? "Uploadingâ€¦" : "Upload"}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                  File upload requires Contributor or higher.
                </p>
              )}

              <div className="mt-4 space-y-2">
                {deliverables.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                    No files uploaded yet.
                  </p>
                ) : (
                  deliverables.map((deliverable) => (
                    <div
                      key={deliverable.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {deliverable.filename}
                        </p>
                        {deliverable.taskId ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            Linked to task
                          </p>
                        ) : null}
                      </div>
                      {canDeleteDeliverables ? (
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeleteDeliverable(deliverable);
                          }}
                          disabled={deliverableDeletingId === deliverable.id}
                          className="ml-3 shrink-0 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          {deliverableDeletingId === deliverable.id
                            ? "â€¦"
                            : "Delete"}
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Sidebar â€” Team + Invite + Activity */}
          <div className="space-y-6 lg:col-span-1">
            {/* Team members */}
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Team
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    void loadMembers("manual");
                  }}
                  className="text-xs text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  â†» Refresh
                </button>
              </div>
              <div className="mt-3 space-y-1">
                {members.length === 0 ? (
                  <p className="py-2 text-sm text-gray-400 dark:text-gray-500">
                    No members loaded.
                  </p>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    >
                      <p className="min-w-0 truncate text-sm text-gray-800 dark:text-gray-200">
                        {member.email}
                      </p>
                      <span
                        className={`ml-2 shrink-0 ${roleBadgeClass(member.role)}`}
                      >
                        {member.role}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Invite member */}
            <section
              id="invite"
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Invite Member
              </h2>
              {canInvite ? (
                <form
                  onSubmit={handleCreateInvite}
                  className="mt-3 flex flex-col gap-2"
                >
                  <input
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="member@company.com"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <select
                      value={inviteRole}
                      onChange={(event) =>
                        setInviteRole(event.target.value as Role)
                      }
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="OWNER">Owner</option>
                      <option value="ADMIN">Admin</option>
                      <option value="CONTRIBUTOR">Contributor</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                    <button
                      type="submit"
                      disabled={inviteSubmitting}
                      className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                    >
                      {inviteSubmitting ? "â€¦" : "Invite"}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  Requires Owner or Admin role.
                </p>
              )}
              {inviteMessage ? (
                <div className="mt-3 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/20">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    {inviteMessage}
                  </p>
                  {inviteLink ? (
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      Share link: {inviteLink}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Invited user: open the link, sign in, then accept.
                  </p>
                </div>
              ) : null}
            </section>

            {/* Activity feed */}
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Activity
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    void loadActivityEvents("manual");
                  }}
                  className="text-xs text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  â†» Refresh
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {activityEvents.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
                    No events yet.
                  </p>
                ) : (
                  activityEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border border-gray-100 px-3 py-2.5 dark:border-gray-800"
                    >
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                        {event.type}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                        {event.actorEmail} &middot;{" "}
                        {new Date(event.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
