import { useClientConfig } from '@libs/app-config-client-ts/use-client-config';
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
export function usePermissionInputs(scope?: AccessScopeAccessor) {
  const config = useClientConfig();
  const policy = usePermissionPolicy(config);
  const facts = useAccessFacts(config);
  const myId = useMyId();
  const subject = createMemo(
    (): Subject =>
      resolveSubject(
        policy(),
        facts.value(),
        resolveResourceRoles(myId(), scope?.())
      )
  );
  return { policy, subject, isLoading: facts.isLoading };
}
