/** @jsxImportSource solid-js */
/**
 * The billing screen rendered for every caller × membership row × billing
 * switch × customer link: exactly the controls, notice and status the view
 * model decided, and nothing else.
 */
import { describe, expect, mock, test } from 'bun:test';
import type { BillingActions } from '@libs/billing-client/billing-plan-card';
import {
  BillingScreenLayout,
  BillingScreenView,
} from '@libs/billing-client/billing-screen-view';
import type { BillingView } from '@libs/billing-client/billing-view-model';
import { buildBillingView } from '@libs/billing-client/billing-view-model';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared/plus-membership-offer';
import { Handles } from '@libs/test-ids-shared/handles';
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { AppRouter } from '@pkgs/ui-root-client/app-router';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client/app-router';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import type { RowKind } from './billing-matrix';
import {
  CALLERS,
  inputFor,
  ROW_KINDS,
  row,
  UNLOCK_LABEL,
} from './billing-matrix';

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
            const credit = screen.queryByTestId(Handles.billingCredit);
            expect(credit !== null).toBe(view.creditCents > 0);
            expect(status.textContent?.length ?? 0).toBeGreaterThan(0);
            cleanup();
          });
        }
      }
    }
  }
});

describe('billing screen: plus credit', () => {
  test('shows the credit left from the yearly plan', () => {
    const view = buildBillingView({
      ...inputFor('account', 'active', true, true),
      row: { ...row('active'), credit_cents: 5300 },
    });
    expect(view.creditCents).toBe(5300);
    renderView(view);
    const credit = screen.getByTestId(Handles.billingCredit);
    expect(credit.getAttribute('data-credit-cents')).toBe('5300');
    expect(credit.textContent).toContain('Plus credit');
    expect(credit.textContent).toContain('yearly plan');
    expect(credit.textContent).toContain('$53.00');
    cleanup();
  });

  test('a debt or a blank balance is not shown as credit', () => {
    for (const credit_cents of [-20, 'nope', null] as const) {
      const view = buildBillingView({
        ...inputFor('account', 'active', true, true),
        row: { ...row('active'), credit_cents },
      });
      expect(view.creditCents).toBe(0);
      renderView(view);
      expect(screen.queryByTestId(Handles.billingCredit)).toBeNull();
      cleanup();
    }
  });
});

describe('billing screen: actions', () => {
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

/** A router that never navigates: the layout only needs one to exist. */
const STILL_ROUTER: AppRouter = {
  push: () => undefined,
  replace: () => undefined,
  back: () => undefined,
  canGoBack: () => false,
};

describe('billing screen layout', () => {
  test('the whole body scrolls, so a short phone never clips the plans', () => {
    // regression: billing-screen-clips-on-short-phone
    const harness = createHarnessClock();
    const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
    const view = buildBillingView(inputFor('guest', 'none', true, false));
    render(() => (
      <I18nProvider i18n={i18n}>
        <ClockProvider clock={harness.clock} timers={harness.timers}>
          <ThemeProvider
            colorScheme="light"
            fixedLayout={{ width: 390, height: 640 }}
          >
            <StaticAppRouterProvider router={STILL_ROUTER}>
              <BillingScreenLayout
                view={view}
                offer={PLUS_MEMBERSHIP_OFFER}
                locale="en-US"
                formatDate={(ms) => new Date(ms).toISOString().slice(0, 10)}
                actions={NO_ACTIONS}
              />
            </StaticAppRouterProvider>
          </ThemeProvider>
        </ClockProvider>
      </I18nProvider>
    ));
    const shell = document.querySelector('[data-screen="billing"]');
    expect(shell).not.toBeNull();
    expect(
      shell?.querySelector('[data-component="ScreenBodyScroll"]')
    ).not.toBeNull();
    expect(screen.getByTestId(Handles.billingScreen)).toBeTruthy();
  });
});
