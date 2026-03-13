import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { createInvite, isValidInviteRole } from "@/lib/invites";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { workspaceId, email, role } = (await request.json()) as {
    workspaceId?: string;
    email?: string;
    role?: string;
  };

  const trimmedWorkspaceId = workspaceId?.trim() ?? "";
  const trimmedEmail = email?.trim() ?? "";
  const trimmedRole = role?.trim() ?? "";

  if (
    !trimmedWorkspaceId ||
    !trimmedEmail ||
    !trimmedEmail.includes("@") ||
    !isValidInviteRole(trimmedRole)
  ) {
    return NextResponse.json(
      { error: "Invalid invite payload" },
      { status: 400 },
    );
  }

  try {
    const invite = await createInvite(
      session.user.id,
      trimmedWorkspaceId,
      trimmedEmail,
      trimmedRole,
    );

    return NextResponse.json({ invite });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create invite";

    if (message.includes("Only workspace Owners and Admins")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 },
    );
  }
}
