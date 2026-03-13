import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  ACTIVE_WORKSPACE_COOKIE_OPTIONS,
} from "@/lib/workspace-context";
import { assertWorkspaceAccessForUser } from "@/lib/workspaces";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { workspaceId } = (await request.json()) as { workspaceId?: string };

  if (!workspaceId?.trim()) {
    return NextResponse.json(
      { error: "Workspace ID is required" },
      { status: 400 },
    );
  }

  try {
    await assertWorkspaceAccessForUser(session.user.id, workspaceId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Workspace access denied.";

    return NextResponse.json({ error: message }, { status: 403 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(
    ACTIVE_WORKSPACE_COOKIE_NAME,
    workspaceId,
    ACTIVE_WORKSPACE_COOKIE_OPTIONS,
  );

  return response;
}
