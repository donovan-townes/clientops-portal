import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

describe("EPIC 3 red baseline — /api/invites", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXTAUTH_SECRET = "test-secret";
    getServerSessionMock.mockReset();
  });

  it("returns 401 from POST /api/invites when unauthenticated", async () => {
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

  it("returns 400 from POST /api/invites when payload is invalid", async () => {
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
});

describe("EPIC 3 red baseline — /api/invites/accept", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXTAUTH_SECRET = "test-secret";
    getServerSessionMock.mockReset();
  });

  it("returns 400 from POST /api/invites/accept when token is missing", async () => {
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
});
