import type { SessionProject } from '@/types/database.types';

/**
 * Permisos en el cliente.
 *
 * IMPORTANTE: esto decide QUE SE MUESTRA, no que es posible. La frontera
 * de seguridad real es RLS en PostgreSQL. Ocultar un boton es usabilidad;
 * impedir la escritura es RLS. Ambas capas existen y no se sustituyen.
 */

export type Permission = string; // '<modulo>.<accion>'

export function can(project: SessionProject | null | undefined, permission: Permission): boolean {
  if (!project) return false;
  return project.permissions.includes(permission);
}

export function canAny(project: SessionProject | null | undefined, permissions: Permission[]): boolean {
  if (!project) return false;
  return permissions.some((p) => project.permissions.includes(p));
}

export function canAll(project: SessionProject | null | undefined, permissions: Permission[]): boolean {
  if (!project) return false;
  return permissions.every((p) => project.permissions.includes(p));
}

/** Un modulo se muestra si esta habilitado en el proyecto Y el usuario puede verlo. */
export function moduleVisible(project: SessionProject | null | undefined, moduleCode: string): boolean {
  if (!project) return false;
  return project.modules.includes(moduleCode) && can(project, `${moduleCode}.view`);
}

/**
 * Lanza si falta el permiso. Se usa en Server Actions como primera linea
 * de defensa, para devolver un mensaje util antes de que RLS rechace la
 * operacion con un error opaco.
 */
export function assertPermission(
  project: SessionProject | null | undefined,
  permission: Permission,
): void {
  if (!can(project, permission)) {
    throw new PermissionError(permission);
  }
}

export class PermissionError extends Error {
  constructor(public readonly permission: Permission) {
    super(`No tienes permiso para realizar esta accion (${permission}).`);
    this.name = 'PermissionError';
  }
}
