import type { RoleId } from './catalog';

/** Thrown when a subject role or a `grants` target is absent from the policy. */
export class UnknownRoleError extends Error {
  readonly role: RoleId;

  constructor(role: RoleId) {
    super(`unknown role: ${role}`);
    this.name = 'UnknownRoleError';
    this.role = role;
  }
}
