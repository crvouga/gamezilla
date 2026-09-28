/** @jsxImportSource solid-js */
/**
 * The billing screen rendered for every caller × membership row × billing
 * switch × customer link: exactly the controls, notice and status the view
 * model decided, and nothing else.
 */
import { describe, expect, mock, test } from 'bun:test';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing/public/offer';
import {
  type BillingActions,
  BillingScreenView,
} from '@libs/billing/root/client/billing-screen-view';
import {
  type BillingView,
  buildBillingView,
} from '@libs/billing/root/client/billing-view-model';
import { Handles } from '@libs/test-ids';
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { createHarnessClock } from '@pkgs/clock/harness-clock';
import { ClockProvider } from '@pkgs/clock/solid';
import { ThemeProvider } from '@pkgs/ui';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';

import {
  CALLERS,
  inputFor,
  ROW_KINDS,
  type RowKind,
  UNLOCK_LABEL,
} from './support/billing-matrix';

const KINDS = Object.keys(ROW_KINDS) as RowKind[];

const NO_ACTIONS: BillingActions = {
  subscribe: () => Promise.resolve(),
  manage: () => Promise.resolve(),
  unlock: () => undefined,
};

function renderView(view: BillingView, actions: BillingActions = NO_ACTIONS) {
  const harness = createHarnessClock();
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  return render(() => (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={harness.clock} timers={harness.timers}>
        <ThemeProvider
          colorScheme="light"
          fixedLayout={{ width: 1024, height: 768 }}
        >
          <BillingScreenView
            view={view}
            offer={PLUS_MEMBERSHIP_OFFER}
            locale="en-US"
            formatDate={(ms) => new Date(ms).toISOString().slice(0, 10)}
            actions={actions}
          />
        </ThemeProvider>
      </ClockProvider>
    </I18nProvider>
  ));
}

function present(testId: string): boolean {
  return screen.queryByTestId(testId) !== null;
}

/** The status line's date and the current plan, as machine-readable marks. */
function expectMarkers(view: BillingView, status: HTMLElement): void {
  expect(status.getAttribute('data-period-end')).toBe(
    view.periodEndMs === null ? null : new Date(view.periodEndMs).toISOString()
  );
  for (const key of ['subscription_monthly', 'subscription_yearly']) {
    const price = screen.queryByTestId(Handles.billingPrice(key));
    expect(price?.getAttribute('aria-current') ?? null).toBe(
      view.showPricing && view.priceKey === key ? 'true' : null
    );
  }
}

describe('billing screen: every caller × row × switch × customer', () => {
  for (const caller of CALLERS) {
    for (const kind of KINDS) {
      for (const enabled of [true, false]) {
        for (const hasCustomer of [true, false]) {
          const name = `${caller} · ${kind} · billing ${enabled ? 'on' : 'off'} · ${hasCustomer ? 'customer' : 'no customer'}`;
          test(name, () => {
            const view = buildBillingView(
              inputFor(caller, kind, enabled, hasCustomer)
            );
            renderView(view);
            expect(screen.getByTestId(Handles.billingTier).textContent).toBe(
              view.tier
            );
            expect(present(Handles.billingSubscribe)).toBe(
              view.primary === 'subscribe'
            );
            expect(present(Handles.billingUnlock)).toBe(
              view.primary === 'unlock'
            );
            expect(present(Handles.billingManage)).toBe(view.manage);
            expect(present(Handles.billingNotice)).toBe(view.notice !== null);
            expect(present(Handles.billingPricing)).toBe(view.showPricing);
            expect(present(Handles.billingBenefits)).toBe(view.showPricing);
            const status = screen.getByTestId(Handles.billingStatus);
            expect(status.getAttribute('data-state')).toBe(view.state);
            expectMarkers(view, status);
            expect(status.textContent?.length ?? 0).toBeGreaterThan(0);
            cleanup();
          });
        }
      }
    }
  }
});

describe('billing screen: copy and actions', () => {
  test('a trial says when it ends and how long is left', () => {
    renderView(buildBillingView(inputFor('account', 'trialing', true, true)));
    expect(screen.getByTestId(Handles.billingStatus).textContent).toBe(
      'Free trial · ends 2026-10-01 (10 days left)'
    );
    cleanup();
  });

  test('the plan the membership is on is marked as the current one', () => {
    const input = inputFor('account', 'active', true, true);
    const row = { ...input.row, price_key: 'subscription_yearly' };
    renderView(buildBillingView({ ...input, row: row as typeof input.row }));
    expect(
      screen
        .getByTestId(Handles.billingPrice('subscription_yearly'))
        .getAttribute('aria-current')
    ).toBe('true');
    expect(
      screen
        .getByTestId(Handles.billingPrice('subscription_monthly'))
        .getAttribute('aria-current')
    ).toBeNull();
    cleanup();
  });

  test('a failed payment asks for a new card in the portal', () => {
    renderView(buildBillingView(inputFor('account', 'delinquent', true, true)));
    expect(screen.getByRole('alert').textContent).toContain(
      "Your last payment didn't go through"
    );
    expect(screen.getByTestId(Handles.billingManage).textContent).toContain(
      'Update payment method'
    );
    cleanup();
  });

  test('pricing comes from the offer, with the yearly saving', () => {
    renderView(buildBillingView(inputFor('account', 'none', true, false)));
    const monthly = screen.getByTestId(
      Handles.billingPrice('subscription_monthly')
    );
    const yearly = screen.getByTestId(
      Handles.billingPrice('subscription_yearly')
    );
    expect(monthly.textContent).toContain('$7.00');
    expect(yearly.textContent).toContain('$60.00');
    expect(yearly.textContent).toContain('Save 29%');
    expect(yearly.textContent).toContain('$5.00/month');
    expect(screen.getByTestId(Handles.billingSubscribe).textContent).toContain(
      'Start 7-day free trial'
    );
    cleanup();
  });

  test('buttons call their actions', () => {
    const unlock = mock(() => undefined);
    renderView(buildBillingView(inputFor('guest', 'none', true, false)), {
      ...NO_ACTIONS,
      unlock,
    });
    const button = screen.getByTestId(Handles.billingUnlock);
    expect(button.textContent).toContain(UNLOCK_LABEL);
    fireEvent.click(button);
    expect(unlock).toHaveBeenCalledTimes(1);
    cleanup();

    const subscribe = mock(() => Promise.resolve());
    renderView(buildBillingView(inputFor('account', 'none', true, false)), {
      ...NO_ACTIONS,
      subscribe,
    });
    fireEvent.click(screen.getByTestId(Handles.billingSubscribe));
    expect(subscribe).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
