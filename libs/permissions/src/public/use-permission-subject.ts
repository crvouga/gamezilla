import { resolveSubject, type Subject } from '@pkgs/permissions';
import { type Accessor, createMemo } from 'solid-js';

import { useAccessFacts } from './use-access-facts';
import { usePermissionPolicy } from './use-permission-policy';

/** The caller's subject: roles the live policy's predicates pick from facts. */
export function usePermissionSubject(): Accessor<Subject> {
  const policy = usePermissionPolicy();
  const facts = useAccessFacts();
  return createMemo(() => resolveSubject(policy(), facts()));
}
