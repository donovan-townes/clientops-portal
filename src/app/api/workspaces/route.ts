import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  ACTIVE_WORKSPACE_COOKIE_OPTIONS,
  getActiveWorkspaceIdFromCookieHeader,
} from "@/lib/workspace-context";
import {
  createWorkspaceForUser,
  resolveActiveWorkspaceForUser,
} from "@/lib/workspaces";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const cookieWorkspaceId = getActiveWorkspaceIdFromCookieHeader(
    request.headers.get("cookie"),
  );

  const context = await resolveActiveWorkspaceForUser(
    session.user.id,
    cookieWorkspaceId,
  );

  const response = NextResponse.json({
    workspaces: context.workspaces,
    activeWorkspaceId: context.activeWorkspace?.id ?? null,
  });

  if (context.activeWorkspace && context.shouldPersistActiveWorkspace) {
    response.cookies.set(
      ACTIVE_WORKSPACE_COOKIE_NAME,
      context.activeWorkspace.id,
      ACTIVE_WORKSPACE_COOKIE_OPTIONS,
    );
  }

  return response;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { name } = (await request.json()) as { name?: string };

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "Workspace name is required" },
      { status: 400 },
    );
  }

  const workspace = await createWorkspaceForUser(session.user.id, name);

  const response = NextResponse.json({ workspace });
  response.cookies.set(
    ACTIVE_WORKSPACE_COOKIE_NAME,
    workspace.id,
    ACTIVE_WORKSPACE_COOKIE_OPTIONS,
  );

  return response;
}
