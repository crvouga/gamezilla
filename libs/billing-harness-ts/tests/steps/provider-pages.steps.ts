import {
  leaveCheckout,
  managePlus,
  openBilling,
} from '@libs/billing-harness-ts/billing-actions';
import { STRIPE_PAGE } from '@libs/billing-harness-ts/billing-gestures';
import {
  onCheckout,
  openCheckout,
} from '@libs/billing-harness-ts/checkout-actions';
import { registerBillingPages } from '@libs/billing-harness-ts/provider-pages.steps';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { visible } from '@libs/harness-ts/observations';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';

registerBillingPages<HarnessWorld>({
  showPlans: async (w) => {
    await w.s.apply(signInWithGoogle, 'alice');
    await w.s.apply(openBilling, 'alice');
  },
  leaveCheckout: async (w) => {
    await w.s.apply(leaveCheckout, 'alice');
  },
  openCheckout: async (w) => {
    await w.s.apply(openCheckout, 'alice');
  },
  seeCheckout: async (w) => {
    await w.s.until((s) => onCheckout(s, 'alice'), { pred: Boolean });
  },
  openPortal: async (w) => {
    await w.s.apply(managePlus, 'alice');
  },
  seePortal: async (w) => {
    await w.s.until((s) => visible(s, 'alice', [STRIPE_PAGE.portalReturn]), {
      pred: Boolean,
    });
  },
});
