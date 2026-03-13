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
};

type TasksResponse = {
  tasks: Task[];
  activeWorkspaceId: string;
};

type ActivityItem = {
  id: string;
  message: string;
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
  initialMembers: Member[];
  initialMembersContextWorkspaceId: string | null;
  initialActiveRole: Role | null;
};

export default function WorkspaceDashboardClient({
  initialWorkspaces,
  initialActiveWorkspaceId,
  initialTasks,
  initialTasksContextWorkspaceId,
  initialMembers,
  initialMembersContextWorkspaceId,
  initialActiveRole,
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
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [membersContextWorkspaceId, setMembersContextWorkspaceId] = useState<
    string | null
  >(initialMembersContextWorkspaceId);
  const [activeRole, setActiveRole] = useState<Role | null>(initialActiveRole);
  const [submitting, setSubmitting] = useState(false);
  const [tasksSubmitting, setTasksSubmitting] = useState(false);
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
      setMembers([]);
      setMembersContextWorkspaceId(null);
      setActiveRole(null);
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
    await loadTasks("auto");
    await loadMembers("auto");
  };

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
    await loadTasks("auto");
    await loadMembers("auto");
  };

  const activeWorkspaceName =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name ??
    null;
  const canInvite = activeRole === "OWNER" || activeRole === "ADMIN";

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

      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
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
                <p className="font-medium text-gray-900 dark:text-white">
                  {task.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  workspaceId: {task.workspaceId}
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
