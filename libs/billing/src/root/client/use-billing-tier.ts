import { ROLE } from '@libs/permissions/public/permission-catalog';
import { usePlanRole } from '@libs/permissions/public/use-plan-role';
import { type Accessor, createMemo } from 'solid-js';

import type { BillingTier } from './billing-view-model';

/** The live policy's plan role, as billing names it. A label, never a gate. */
export function useBillingTier(): Accessor<BillingTier> {
  const role = usePlanRole();
  return createMemo(() => {
    if (role() === ROLE.planPaid) return 'paid';
    if (role() === ROLE.planFree) return 'free';
    return 'guest';
  });
}
