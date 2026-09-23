/**
 * Billing's monkey steps: open the plans screen from the global menu, and —
 * for a signed-in person on it — subscribe through the provider's checkout.
 */

import { accountIdOf } from '@libs/sim-harness/system/identity';
import { visible, walkAction } from '@libs/sim-harness/system/walk-action';
import { Handles } from '@libs/test-ids';

import { openBilling, subscribeToPlus } from './billing-actions';

export const walkOpenBilling = walkAction({
  name: 'walkOpenBilling',
  applies: async (step) =>
    (await visible(step, Handles.statusCurrentUser)) &&
    !(await visible(step, Handles.billingScreen)),
  act: ({ s, actorId }) => Promise.resolve(openBilling.act(s, actorId)),
});

export const walkSubscribe = walkAction({
  name: 'walkSubscribe',
  applies: async (step) =>
    (await visible(step, Handles.billingSubscribe)) &&
    (await accountIdOf(step.s, step.actorId)) !== null,
  act: ({ s, actorId }) => Promise.resolve(subscribeToPlus.act(s, actorId)),
});

export const BILLING_WALK_ACTIONS = [walkOpenBilling, walkSubscribe];
