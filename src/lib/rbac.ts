import { Role } from "@prisma/client";

type RoleSet = Set<Role>;

const ACTION_MATRIX = {
  createWorkspace: new Set<Role>([Role.OWNER]),
  inviteMember: new Set<Role>([Role.OWNER, Role.ADMIN]),
  manageMembers: new Set<Role>([Role.OWNER]),
  viewMembers: new Set<Role>([
    Role.OWNER,
    Role.ADMIN,
    Role.CONTRIBUTOR,
    Role.VIEWER,
  ]),
  createTask: new Set<Role>([Role.OWNER, Role.ADMIN, Role.CONTRIBUTOR]),
  editTask: new Set<Role>([Role.OWNER, Role.ADMIN, Role.CONTRIBUTOR]),
  deleteTask: new Set<Role>([Role.OWNER, Role.ADMIN]),
  uploadFile: new Set<Role>([Role.OWNER, Role.ADMIN, Role.CONTRIBUTOR]),
  deleteFile: new Set<Role>([Role.OWNER, Role.ADMIN]),
  viewTasksAndFiles: new Set<Role>([
    Role.OWNER,
    Role.ADMIN,
    Role.CONTRIBUTOR,
    Role.VIEWER,
  ]),
  viewActivityLog: new Set<Role>([
    Role.OWNER,
    Role.ADMIN,
    Role.CONTRIBUTOR,
    Role.VIEWER,
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
