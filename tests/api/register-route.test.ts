import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
};

const bcryptMock = {
  hash: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("bcrypt", () => ({
  default: bcryptMock,
}));

describe("POST /api/register", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.create.mockReset();
    bcryptMock.hash.mockReset();
  });

  it("returns 400 when email or password is missing", async () => {
    const { POST } = await import("@/app/api/register/route");

    const request = new Request("http://localhost:3000/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "" }),
    });

    const response = await POST(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Email and password required");
  });

  it("returns 400 when user already exists", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });

    const { POST } = await import("@/app/api/register/route");

    const request = new Request("http://localhost:3000/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
      }),
    });

    const response = await POST(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("User already exists");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("creates a new user and returns success", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    bcryptMock.hash.mockResolvedValue("hashed-password");
    prismaMock.user.create.mockResolvedValue({ id: "user-2" });

    const { POST } = await import("@/app/api/register/route");

    const request = new Request("http://localhost:3000/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "new@example.com",
        password: "password123",
      }),
    });

    const response = await POST(request);
    const body = (await response.json()) as { success: boolean };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(bcryptMock.hash).toHaveBeenCalledWith("password123", 10);
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        email: "new@example.com",
        passwordHash: "hashed-password",
      },
    });
  });
});
