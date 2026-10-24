import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { AccessScope } from '@libs/permissions-shared-ts/access-scope';
import { resolveResourceRoles } from '@libs/permissions-shared-ts/resource-roles';
import { resolveSubject } from '@pkgs/permissions-shared-ts/resolve';
import type { Subject } from '@pkgs/permissions-shared-ts/subject';
import { type Accessor, createMemo } from 'solid-js';
import { useAccessFacts } from './use-access-facts';
import { usePermissionPolicy } from './use-permission-policy';

/** Scope whose roles track: an accessor, read inside the subject's memo. */
export type AccessScopeAccessor = Accessor<AccessScope | undefined>;

/**
 * The caller's subject: roles the live policy's predicates pick from facts,
 * plus whatever resource-scoped roles `scope` adds.
 */
export function usePermissionSubject(
  scope?: AccessScopeAccessor
): Accessor<Subject> {
  const policy = usePermissionPolicy();
  const facts = useAccessFacts();
  const myId = useMyId();
  return createMemo(() =>
    resolveSubject(policy(), facts(), resolveResourceRoles(myId(), scope?.()))
  );
}
