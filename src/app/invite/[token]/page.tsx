"use client";

import Link from "next/link";
import { use, useState } from "react";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

type AcceptState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; workspaceId: string }
  | { kind: "error"; message: string; status: number };

export default function InviteTokenPage({ params }: InvitePageProps) {
  const { token } = use(params);
  const [state, setState] = useState<AcceptState>({ kind: "idle" });

  const acceptInvite = async () => {
    setState({ kind: "loading" });

    const response = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setState({
        kind: "error",
        message: body.error ?? "Unable to accept invite",
        status: response.status,
      });
      return;
    }

    const body = (await response.json()) as {
      accepted: { invite: { workspaceId: string } };
    };

    setState({
      kind: "success",
      workspaceId: body.accepted.invite.workspaceId,
    });
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-6 py-12">
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Accept Workspace Invite
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Accept your invite to join the workspace.
        </p>

        {state.kind === "error" ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.message}
          </p>
        ) : null}

        {state.kind === "success" ? (
          <div className="space-y-2 text-sm text-green-700 dark:text-green-400">
            <p>Invite accepted successfully.</p>
            <p>Workspace ID: {state.workspaceId}</p>
            <Link
              className="inline-flex rounded-md border border-gray-300 px-3 py-2 text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
              href="/dashboard"
            >
              Go to dashboard
            </Link>
          </div>
        ) : (
          <button
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            disabled={state.kind === "loading"}
            onClick={() => {
              void acceptInvite();
            }}
            type="button"
          >
            {state.kind === "loading" ? "Accepting..." : "Accept invite"}
          </button>
        )}

        {state.kind === "error" && state.status === 401 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You must sign in before accepting this invite.{" "}
            <Link href="/login">Go to login</Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}
