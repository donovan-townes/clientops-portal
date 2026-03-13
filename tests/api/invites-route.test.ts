import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const createInviteMock = vi.fn();
const acceptInviteMock = vi.fn();

class InviteAcceptanceErrorMock extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "EXPIRED" | "ALREADY_ACCEPTED",
    message: string,
  ) {
    super(message);
    this.name = "InviteAcceptanceError";
  }
}

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/invites", () => ({
  createInvite: createInviteMock,
  acceptInvite: acceptInviteMock,
  InviteAcceptanceError: InviteAcceptanceErrorMock,
  isValidInviteRole: (value: string) =>
    ["OWNER", "ADMIN", "CONTRIBUTOR", "VIEWER"].includes(value),
}));

describe("POST /api/invites", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXTAUTH_SECRET = "test-secret";
    getServerSessionMock.mockReset();
    createInviteMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { POST } = await import("@/app/api/invites/route");

    const response = await POST(
      new Request("http://localhost:3000/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: "workspace-1",
          email: "invitee@example.com",
          role: "CONTRIBUTOR",
        }),
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthenticated");
  });

  it("returns 400 when payload is invalid", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    const { POST } = await import("@/app/api/invites/route");

    const response = await POST(
      new Request("http://localhost:3000/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: "workspace-1",
          email: "",
          role: "NOT_A_ROLE",
        }),
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid invite payload");
  });

  it("returns 403 when the actor is not a workspace Owner or Admin", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "user-contributor" },
    });
    createInviteMock.mockRejectedValue(
      new Error("Only workspace Owners and Admins can invite members."),
    );

    const { POST } = await import("@/app/api/invites/route");

    const response = await POST(
      new Request("http://localhost:3000/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: "workspace-1",
          email: "new@example.com",
          role: "CONTRIBUTOR",
        }),
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe(
      "Only workspace Owners and Admins can invite members.",
    );
  });

  it("returns 200 with the invite record when creation succeeds", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-owner" } });
    createInviteMock.mockResolvedValue({
      id: "invite-1",
      workspaceId: "workspace-1",
      email: "invitee@example.com",
      role: "CONTRIBUTOR",
      token: "test-token-hex",
      expiresAt: new Date("2026-03-19T00:00:00.000Z"),
      acceptedAt: null,
      createdAt: new Date("2026-03-12T00:00:00.000Z"),
    });

    const { POST } = await import("@/app/api/invites/route");

    const response = await POST(
      new Request("http://localhost:3000/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: "workspace-1",
          email: "invitee@example.com",
          role: "CONTRIBUTOR",
        }),
      }),
    );
    const body = (await response.json()) as {
      invite: { id: string; token: string; email: string };
    };

    expect(response.status).toBe(200);
    expect(body.invite.id).toBe("invite-1");
    expect(body.invite.token).toBe("test-token-hex");
    expect(body.invite.email).toBe("invitee@example.com");
    expect(createInviteMock).toHaveBeenCalledWith(
      "user-owner",
      "workspace-1",
      "invitee@example.com",
      "CONTRIBUTOR",
    );
  });
});

describe("POST /api/invites/accept", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXTAUTH_SECRET = "test-secret";
    getServerSessionMock.mockReset();
    acceptInviteMock.mockReset();
  });

  it("returns 400 when token is missing", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-2" } });

    const { POST } = await import("@/app/api/invites/accept/route");

    const response = await POST(
      new Request("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "" }),
      }),
    );

    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invite token is required");
  });

  it("returns 410 when invite token is expired", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-2" } });
    acceptInviteMock.mockRejectedValue(
      new InviteAcceptanceErrorMock("EXPIRED", "Invite has expired"),
    );

    const { POST } = await import("@/app/api/invites/accept/route");

    const response = await POST(
      new Request("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "expired-token" }),
      }),
    );

    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(410);
    expect(body.error).toBe("Invite has expired");
  });

  it("returns 409 when invite was already accepted", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-2" } });
    acceptInviteMock.mockRejectedValue(
      new InviteAcceptanceErrorMock(
        "ALREADY_ACCEPTED",
        "Invite has already been accepted",
      ),
    );

    const { POST } = await import("@/app/api/invites/accept/route");

    const response = await POST(
      new Request("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "accepted-token" }),
      }),
    );

    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(body.error).toBe("Invite has already been accepted");
  });

  it("returns 200 and accepted payload for valid token", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-2" } });
    acceptInviteMock.mockResolvedValue({
      membership: {
        id: "membership-1",
        workspaceId: "workspace-1",
        userId: "user-2",
        role: "CONTRIBUTOR",
      },
      invite: {
        id: "invite-1",
        workspaceId: "workspace-1",
        email: "invitee@example.com",
        role: "CONTRIBUTOR",
      },
    });

    const { POST } = await import("@/app/api/invites/accept/route");

    const response = await POST(
      new Request("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "valid-token" }),
      }),
    );

    const body = (await response.json()) as {
      accepted: {
        membership: { id: string; workspaceId: string; userId: string };
        invite: { id: string; workspaceId: string; role: string };
      };
    };

    expect(response.status).toBe(200);
    expect(body.accepted.membership.id).toBe("membership-1");
    expect(body.accepted.invite.id).toBe("invite-1");
    expect(acceptInviteMock).toHaveBeenCalledWith("user-2", "valid-token");
  });
});
