import { createSubject, type Subject } from '@pkgs/permissions';
import { type Accessor, createMemo } from 'solid-js';

import { usePlanRole } from './use-plan-role';

/** The app-wide subject: the caller's plan role. */
export function usePermissionSubject(): Accessor<Subject> {
  const planRole = usePlanRole();
  return createMemo(() => createSubject([planRole()]));
}
