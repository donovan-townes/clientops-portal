export const ACTIVE_WORKSPACE_COOKIE_NAME = "activeWorkspaceId";

export const ACTIVE_WORKSPACE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export function getActiveWorkspaceIdFromCookieHeader(
  cookieHeader: string | null,
) {
  if (!cookieHeader) return undefined;

  const target = `${ACTIVE_WORKSPACE_COOKIE_NAME}=`;

  for (const part of cookieHeader.split(";")) {
    const normalized = part.trim();

    if (normalized.startsWith(target)) {
      return decodeURIComponent(normalized.slice(target.length));
    }
  }

  return undefined;
}
