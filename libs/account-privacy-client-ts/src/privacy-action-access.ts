import { useDenialView } from '@libs/permissions-client-ts/denial-surface';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import type { AppGrantKey } from '@libs/permissions-shared-ts/permission-catalog';
import { type Accessor, createMemo } from 'solid-js';

/** Current permission availability, distinct from a previous request's refusal. */
export type PrivacyActionAccess =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'denied'; readonly denial: DenialView };

export function usePrivacyActionAccess(
  action: AppGrantKey,
  testId: string
): Accessor<PrivacyActionAccess> {
  const decision = useDecision(action);
  const denial = useDenialView({
    get decision() {
      return decision();
    },
    testId,
  });
  return createMemo<PrivacyActionAccess>(() =>
    decision().allowed
      ? { kind: 'allowed' }
      : { kind: 'denied', denial: denial() }
  );
}
