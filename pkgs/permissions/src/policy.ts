import type { LimitKey, PermissionKey, RoleId } from './catalog';

/** One role's declarative grants, permissions and counted caps. */
export type RoleSpec<
  P extends string = PermissionKey,
  L extends string = LimitKey,
> = {
  /** Roles whose grants this role also receives (transitive). */
  readonly grants?: readonly RoleId[];
  readonly permissions?: readonly P[];
  /** `null` = unlimited; a finite number is an exclusive cap (`usage < cap`). */
  readonly limits?: Readonly<Partial<Record<L, number | null>>>;
};

/** The whole declarative policy: role id to role spec. */
export type PermissionPolicy<
  P extends string = PermissionKey,
  L extends string = LimitKey,
> = {
  readonly roles: Readonly<Record<RoleId, RoleSpec<P, L>>>;
};

/** Typed identity so a policy literal is checked against the app's catalogs. */
export function definePolicy<P extends string, L extends string>(
  policy: PermissionPolicy<P, L>
): PermissionPolicy<P, L> {
  return policy;
}
