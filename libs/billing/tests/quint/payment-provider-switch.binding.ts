/**
 * `specs/billing/payment-provider-switch.qnt` against billing's lifecycle
 * composition, with Alice and Bob signed in on their own devices. The team's
 * switch is `switchPaymentProvider`; what each provider does to a membership
 * is the tester acting at the provider holding it (`observeMembership`), and a
 * repeated piece of news is `repeatProviderNews`. The model's state is read
 * back from the membership that governs each person's access (its status and
 * the provider holding it) and where new checkouts go.
 */

import {
  FIRST_PAYMENT_PROVIDER,
  observeMembership,
  openBilling,
  repeatProviderNews,
  SECOND_PAYMENT_PROVIDER,
  subscribeToPlus,
  switchPaymentProvider,
} from '@libs/billing/harness/billing-actions';
import {
  checkoutProvider,
  governingMembership,
} from '@libs/billing/harness/billing-reads';
import { focusActor, signInWithGoogle } from '@libs/harness';
import type { QuintHarnessWorld } from '@libs/harness/quint/world';
import { accountIdOf } from '@libs/harness/system/identity';
import type { QuintValue } from '@pkgs/quint/itf';
import { bindQuintModel, type Picks } from '@pkgs/quint/registry';

const PEOPLE = ['alice', 'bob'] as const;

/** The model's payment providers, by the id the app knows each by. */
const PROVIDER_IDS: Readonly<Record<string, string>> = {
  first: FIRST_PAYMENT_PROVIDER,
  second: SECOND_PAYMENT_PROVIDER,
};

function modelProviderOf(id: string): string {
  const found = Object.entries(PROVIDER_IDS).find(([, known]) => known === id);
  return found?.[0] ?? `unknown provider ${id}`;
}

function person(picks: Picks): string {
  return String(picks['person']);
}

bindQuintModel<QuintHarnessWorld>({
  model: 'payment-provider-switch',
  traces: 8,
  maxSteps: 12,
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      for (const actor of PEOPLE) {
        await w.s.apply(signInWithGoogle, actor);
        await w.s.apply(openBilling, actor);
      }
    },
    subscribe: async (w, picks) => {
      const actor = person(picks);
      await w.s.apply(focusActor, actor);
      await w.s.apply(subscribeToPlus, actor);
    },
    periodEnd: async (w, picks) => {
      await w.s.apply(observeMembership, person(picks), 'period_end');
    },
    cancelImmediately: async (w, picks) => {
      await w.s.apply(observeMembership, person(picks), 'cancel_now');
    },
    switchPaymentProvider: async (w) => {
      const now = await w.s.read(checkoutProvider);
      await w.s.apply(
        switchPaymentProvider,
        now === FIRST_PAYMENT_PROVIDER
          ? SECOND_PAYMENT_PROVIDER
          : FIRST_PAYMENT_PROVIDER
      );
    },
    _providerRepeatsNews: async (w, picks) => {
      const provider = PROVIDER_IDS[String(picks['provider'])];
      if (provider === undefined) {
        throw new Error(`no payment provider ${String(picks['provider'])}`);
      }
      await w.s.apply(repeatProviderNews, person(picks), provider, {
        back: Number(picks['back']),
      });
    },
  },
  observe: async (w) => {
    const membershipStatus = new Map<QuintValue, QuintValue>();
    const billingPortalAt = new Map<QuintValue, QuintValue>();
    for (const actor of PEOPLE) {
      const accountId = await w.quiet.read(accountIdOf, actor);
      if (accountId === null) throw new Error(`${actor} is signed out`);
      const governing = await w.quiet.read(governingMembership, accountId);
      membershipStatus.set(actor, governing?.status ?? 'none');
      billingPortalAt.set(
        actor,
        governing === null ? 'none' : modelProviderOf(governing.provider)
      );
    }
    return {
      newMembershipsAt: modelProviderOf(await w.quiet.read(checkoutProvider)),
      membershipStatus,
      billingPortalAt,
    };
  },
});
