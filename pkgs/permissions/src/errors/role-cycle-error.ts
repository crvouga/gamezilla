import type { RoleId } from '../catalog';

/** Thrown when role `grants` form a cycle. */
export class RoleCycleError extends Error {
  readonly roles: readonly RoleId[];

  constructor(roles: readonly RoleId[]) {
    super(`role grants form a cycle: ${roles.join(' -> ')}`);
    this.name = 'RoleCycleError';
    this.roles = roles;
  }
}
