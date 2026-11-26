import { managePlus } from '@libs/billing-harness-ts/billing-actions';
import { STRIPE_PAGE } from '@libs/billing-harness-ts/billing-gestures';
import {
  onCheckout,
  openCheckout,
} from '@libs/billing-harness-ts/checkout-actions';
import { Then, When } from '@libs/harness-ts/define';
import { visible } from '@libs/harness-ts/observations';
import type { Actor } from '@libs/harness-ts/parameter-types';

When('{actor} chooses to start the free trial', async (w, actor: Actor) => {
  await w.s.apply(openCheckout, actor);
});

Then(
  '{actor} can enter a payment method at checkout',
  async (w, actor: Actor) => {
    await w.s.until((s) => onCheckout(s, actor), { pred: Boolean });
  }
);

When('{actor} chooses to manage her membership', async (w, actor: Actor) => {
  await w.s.apply(managePlus, actor);
});

Then(
  '{actor} can return to the app from the billing portal',
  async (w, actor: Actor) => {
    await w.s.until((s) => visible(s, actor, [STRIPE_PAGE.portalReturn]), {
      pred: Boolean,
    });
  }
);
