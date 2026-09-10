export type TenantId = string;
export type UserId = string;
export type EntityId = string;
export declare const UserRoles: {
    readonly OWNER: "OWNER";
    readonly ADMIN: "ADMIN";
    readonly MANAGER: "MANAGER";
    readonly EMPLOYEE: "EMPLOYEE";
    readonly MARKETING: "MARKETING";
    readonly FINANCE: "FINANCE";
    readonly SUPPORT: "SUPPORT";
    readonly SUPER_ADMIN: "SUPER_ADMIN";
};
export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];
