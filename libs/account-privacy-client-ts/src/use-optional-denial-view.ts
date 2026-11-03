import { useDenialView } from '@libs/permissions-client-ts/denial-surface';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { type Accessor, createMemo } from 'solid-js';

/** Stands in while there is no denial; its resolution is never shown. */
const NO_DENIAL: Decision = { allowed: true, policyVersion: '' };

/**
 * A denial that comes and goes (a refused request), resolved to view data
 * while present: its copy, way forward and `testId` handles.
 */
export function useOptionalDenialView(
  decision: Accessor<Decision | null>,
  testId: string
): Accessor<DenialView | undefined> {
  const view = useDenialView({
    get decision() {
      return decision() ?? NO_DENIAL;
    },
    testId,
  });
  return createMemo(() => (decision() === null ? undefined : view()));
}
