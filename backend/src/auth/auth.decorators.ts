import { SetMetadata } from '@nestjs/common';
import type { EmployeeRole } from '../employees/employee.entity.js';

// Roles carried in the JWT. 'admin' = master password login (no employee row)
export type AppRole = EmployeeRole | 'admin';

export interface AuthUser {
  id: number; // 0 for the master admin
  name: string;
  role: AppRole;
}

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

// Route reachable without a token (login only)
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Restrict a route to some roles; without it any logged-in user passes
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);

// Shortcut for everything under the admin page
export const ADMIN_ROLES: AppRole[] = ['admin', 'manager'];
export const AdminOnly = () => Roles(...ADMIN_ROLES);
