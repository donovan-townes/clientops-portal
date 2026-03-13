import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { listMembersForWorkspace } from "@/lib/members";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  ACTIVE_WORKSPACE_COOKIE_OPTIONS,
  getActiveWorkspaceIdFromCookieHeader,
} from "@/lib/workspace-context";
import { resolveActiveWorkspaceForUser } from "@/lib/workspaces";

function getContextErrorResponse() {
  return NextResponse.json(
    { error: "No active workspace. Create a workspace first." },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const candidateWorkspaceId = getActiveWorkspaceIdFromCookieHeader(
    request.headers.get("cookie"),
  );

  const context = await resolveActiveWorkspaceForUser(
    session.user.id,
    candidateWorkspaceId,
  );

  if (!context.activeWorkspace) {
    return getContextErrorResponse();
  }

  try {
    const { members, activeRole } = await listMembersForWorkspace(
      session.user.id,
      context.activeWorkspace.id,
    );

    const response = NextResponse.json({
      members,
      activeRole,
      activeWorkspaceId: context.activeWorkspace.id,
    });

    if (context.shouldPersistActiveWorkspace) {
      response.cookies.set(
        ACTIVE_WORKSPACE_COOKIE_NAME,
        context.activeWorkspace.id,
        ACTIVE_WORKSPACE_COOKIE_OPTIONS,
      );
    }

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load members.";

    if (message === "Workspace access denied.") {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Unable to load members." },
      { status: 500 },
    );
  }
}
