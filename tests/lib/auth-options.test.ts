import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  user: {
    findUnique: vi.fn(),
  },
};

const bcryptMock = {
  compare: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("bcrypt", () => ({
  default: bcryptMock,
}));

describe("authOptions Credentials authorize", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXTAUTH_SECRET = "test-secret";
    prismaMock.user.findUnique.mockReset();
    bcryptMock.compare.mockReset();
  });

  it("returns null when credentials are missing", async () => {
    const { authorizeCredentials } = await import("@/lib/auth");

    const result = await authorizeCredentials(undefined);

    expect(result).toBeNull();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when user is not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const { authorizeCredentials } = await import("@/lib/auth");

    const result = await authorizeCredentials({
      email: "missing@example.com",
      password: "password123",
    });

    expect(result).toBeNull();
  });

  it("returns null when password does not match", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      passwordHash: "stored-hash",
    });
    bcryptMock.compare.mockResolvedValue(false);

    const { authorizeCredentials } = await import("@/lib/auth");

    const result = await authorizeCredentials({
      email: "test@example.com",
      password: "wrongpass",
    });

    expect(result).toBeNull();
    expect(bcryptMock.compare).toHaveBeenCalledWith("wrongpass", "stored-hash");
  });

  it("returns user id and email when credentials are valid", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-2",
      email: "valid@example.com",
      passwordHash: "stored-hash",
    });
    bcryptMock.compare.mockResolvedValue(true);

    const { authorizeCredentials } = await import("@/lib/auth");

    const result = (await authorizeCredentials({
      email: "valid@example.com",
      password: "password123",
    })) as { id: string; email: string } | null;

    expect(result).toEqual({
      id: "user-2",
      email: "valid@example.com",
    });
  });

  it("stores the user id on the jwt token after sign-in", async () => {
    const { authOptions } = await import("@/lib/auth");

    const token = await authOptions.callbacks?.jwt?.({
      token: {},
      user: { id: "user-3", email: "token@example.com" },
    } as never);

    expect(token).toMatchObject({ userId: "user-3" });
  });

  it("exposes the user id on the session object", async () => {
    const { authOptions } = await import("@/lib/auth");

    const session = await authOptions.callbacks?.session?.({
      session: {
        user: { email: "session@example.com" },
        expires: "2099-01-01T00:00:00.000Z",
      },
      token: { userId: "user-4" },
    } as never);

    expect(session).toMatchObject({
      user: {
        id: "user-4",
        email: "session@example.com",
      },
    });
  });
});
