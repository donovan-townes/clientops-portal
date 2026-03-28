export type Role = "OWNER" | "ADMIN" | "CONTRIBUTOR" | "VIEWER";

export const ROLES = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  CONTRIBUTOR: "CONTRIBUTOR",
  VIEWER: "VIEWER",
} as const satisfies Record<Role, Role>;

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | { [key: string]: JsonValue }
  | JsonValue[];
