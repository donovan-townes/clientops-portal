import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { InviteAcceptanceError, acceptInvite } from "@/lib/invites";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { token } = (await request.json()) as { token?: string };
  const trimmedToken = token?.trim() ?? "";

  if (!trimmedToken) {
    return NextResponse.json(
      { error: "Invite token is required" },
      { status: 400 },
    );
  }

  try {
    const accepted = await acceptInvite(session.user.id, trimmedToken);
    return NextResponse.json({ accepted });
  } catch (error) {
    if (error instanceof InviteAcceptanceError) {
      if (error.code === "EXPIRED") {
        return NextResponse.json({ error: error.message }, { status: 410 });
      }

      if (error.code === "ALREADY_ACCEPTED") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }

      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 },
    );
  }
}
