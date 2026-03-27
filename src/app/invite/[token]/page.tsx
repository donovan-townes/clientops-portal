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
    <main className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-6 dark:from-gray-950 dark:to-gray-900">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-xl text-white">
              ✉️
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Workspace Invitation
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Accept your invite to join the shared workspace.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          {state.kind === "error" ? (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
              {state.message}
            </div>
          ) : null}

          {state.kind === "success" ? (
            <div className="space-y-3 text-sm text-emerald-700 dark:text-emerald-400">
              <p className="font-medium">Invite accepted successfully.</p>
              <p>You can now access this workspace from your dashboard.</p>
              <Link
                className="inline-flex rounded-lg border border-gray-300 px-3 py-2 text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                href="/dashboard"
              >
                Go to dashboard
              </Link>
            </div>
          ) : (
            <button
              className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 py-3 text-sm font-semibold text-white transition-all hover:from-blue-600 hover:to-cyan-600 disabled:opacity-60"
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
              <Link
                href="/login"
                className="font-medium text-cyan-500 hover:text-cyan-600"
              >
                Go to login
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
