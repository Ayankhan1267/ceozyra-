export type TenantId = string;
export type UserId = string;
export type EntityId = string;
export const UserRoles = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  MARKETING: 'MARKETING',
  FINANCE: 'FINANCE',
  SUPPORT: 'SUPPORT',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;
export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];
