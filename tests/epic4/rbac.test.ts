import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  canCreateWorkspace,
  canInvite,
  canManageMembers,
  canViewMembers,
  canCreateTask,
  canEditTask,
  canDeleteTask,
  canUploadFile,
  canDeleteFile,
  canViewTasksAndFiles,
  canViewActivityLog,
} from "@/lib/rbac";

const ALL_ROLES: Role[] = [
  Role.OWNER,
  Role.ADMIN,
  Role.CONTRIBUTOR,
  Role.VIEWER,
];

describe("EPIC 4 — RBAC utility contract", () => {
  it("allows only OWNER to create workspace", () => {
    expect(canCreateWorkspace(Role.OWNER)).toBe(true);
    expect(canCreateWorkspace(Role.ADMIN)).toBe(false);
    expect(canCreateWorkspace(Role.CONTRIBUTOR)).toBe(false);
    expect(canCreateWorkspace(Role.VIEWER)).toBe(false);
  });

  it("allows OWNER and ADMIN to invite members", () => {
    expect(canInvite(Role.OWNER)).toBe(true);
    expect(canInvite(Role.ADMIN)).toBe(true);
    expect(canInvite(Role.CONTRIBUTOR)).toBe(false);
    expect(canInvite(Role.VIEWER)).toBe(false);
  });

  it("allows only OWNER to manage member roles", () => {
    expect(canManageMembers(Role.OWNER)).toBe(true);
    expect(canManageMembers(Role.ADMIN)).toBe(false);
    expect(canManageMembers(Role.CONTRIBUTOR)).toBe(false);
    expect(canManageMembers(Role.VIEWER)).toBe(false);
  });

  it("allows all roles to view members", () => {
    for (const role of ALL_ROLES) {
      expect(canViewMembers(role)).toBe(true);
    }
  });

  it("allows OWNER/ADMIN/CONTRIBUTOR to create tasks", () => {
    expect(canCreateTask(Role.OWNER)).toBe(true);
    expect(canCreateTask(Role.ADMIN)).toBe(true);
    expect(canCreateTask(Role.CONTRIBUTOR)).toBe(true);
    expect(canCreateTask(Role.VIEWER)).toBe(false);
  });

  it("allows OWNER/ADMIN/CONTRIBUTOR to edit tasks", () => {
    expect(canEditTask(Role.OWNER)).toBe(true);
    expect(canEditTask(Role.ADMIN)).toBe(true);
    expect(canEditTask(Role.CONTRIBUTOR)).toBe(true);
    expect(canEditTask(Role.VIEWER)).toBe(false);
  });

  it("allows only OWNER/ADMIN to delete tasks", () => {
    expect(canDeleteTask(Role.OWNER)).toBe(true);
    expect(canDeleteTask(Role.ADMIN)).toBe(true);
    expect(canDeleteTask(Role.CONTRIBUTOR)).toBe(false);
    expect(canDeleteTask(Role.VIEWER)).toBe(false);
  });

  it("allows OWNER/ADMIN/CONTRIBUTOR to upload files", () => {
    expect(canUploadFile(Role.OWNER)).toBe(true);
    expect(canUploadFile(Role.ADMIN)).toBe(true);
    expect(canUploadFile(Role.CONTRIBUTOR)).toBe(true);
    expect(canUploadFile(Role.VIEWER)).toBe(false);
  });

  it("allows only OWNER/ADMIN to delete files", () => {
    expect(canDeleteFile(Role.OWNER)).toBe(true);
    expect(canDeleteFile(Role.ADMIN)).toBe(true);
    expect(canDeleteFile(Role.CONTRIBUTOR)).toBe(false);
    expect(canDeleteFile(Role.VIEWER)).toBe(false);
  });

  it("allows all roles to view tasks and files", () => {
    for (const role of ALL_ROLES) {
      expect(canViewTasksAndFiles(role)).toBe(true);
    }
  });

  it("allows all roles to view activity log", () => {
    for (const role of ALL_ROLES) {
      expect(canViewActivityLog(role)).toBe(true);
    }
  });
});
