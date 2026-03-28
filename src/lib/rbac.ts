import type { Role } from "@/lib/domain-types";
import { ROLES } from "@/lib/domain-types";

type RoleSet = Set<Role>;

const ACTION_MATRIX = {
  createWorkspace: new Set<Role>([ROLES.OWNER]),
  inviteMember: new Set<Role>([ROLES.OWNER, ROLES.ADMIN]),
  manageMembers: new Set<Role>([ROLES.OWNER]),
  viewMembers: new Set<Role>([
    ROLES.OWNER,
    ROLES.ADMIN,
    ROLES.CONTRIBUTOR,
    ROLES.VIEWER,
  ]),
  createTask: new Set<Role>([ROLES.OWNER, ROLES.ADMIN, ROLES.CONTRIBUTOR]),
  editTask: new Set<Role>([ROLES.OWNER, ROLES.ADMIN, ROLES.CONTRIBUTOR]),
  deleteTask: new Set<Role>([ROLES.OWNER, ROLES.ADMIN]),
  uploadFile: new Set<Role>([ROLES.OWNER, ROLES.ADMIN, ROLES.CONTRIBUTOR]),
  deleteFile: new Set<Role>([ROLES.OWNER, ROLES.ADMIN]),
  viewTasksAndFiles: new Set<Role>([
    ROLES.OWNER,
    ROLES.ADMIN,
    ROLES.CONTRIBUTOR,
    ROLES.VIEWER,
  ]),
  viewActivityLog: new Set<Role>([
    ROLES.OWNER,
    ROLES.ADMIN,
    ROLES.CONTRIBUTOR,
    ROLES.VIEWER,
  ]),
} as const;

function hasRoleAccess(role: Role, allowedRoles: RoleSet) {
  return allowedRoles.has(role);
}

export function canCreateWorkspace(role: Role) {
  return hasRoleAccess(role, ACTION_MATRIX.createWorkspace);
}

export function canInvite(role: Role) {
  return hasRoleAccess(role, ACTION_MATRIX.inviteMember);
}

export function canManageMembers(role: Role) {
  return hasRoleAccess(role, ACTION_MATRIX.manageMembers);
}

export function canViewMembers(role: Role) {
  return hasRoleAccess(role, ACTION_MATRIX.viewMembers);
}

export function canCreateTask(role: Role) {
  return hasRoleAccess(role, ACTION_MATRIX.createTask);
}

export function canEditTask(role: Role) {
  return hasRoleAccess(role, ACTION_MATRIX.editTask);
}

export function canDeleteTask(role: Role) {
  return hasRoleAccess(role, ACTION_MATRIX.deleteTask);
}

export function canUploadFile(role: Role) {
  return hasRoleAccess(role, ACTION_MATRIX.uploadFile);
}

export function canDeleteFile(role: Role) {
  return hasRoleAccess(role, ACTION_MATRIX.deleteFile);
}

export function canViewTasksAndFiles(role: Role) {
  return hasRoleAccess(role, ACTION_MATRIX.viewTasksAndFiles);
}

export function canViewActivityLog(role: Role) {
  return hasRoleAccess(role, ACTION_MATRIX.viewActivityLog);
}
