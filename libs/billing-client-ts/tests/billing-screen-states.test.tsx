/** @jsxImportSource solid-js */
/**
 * The billing screen's in-between states: a membership not known yet, a
 * paid checkout whose membership has not shown, a trial's last day, the last
 * day of paid access, and why opening checkout failed.
 */
import { describe, expect, test } from 'bun:test';
import type { BillingActions } from '@libs/billing-client-ts/billing-plan-actions';
import { BillingRequestError } from '@libs/billing-client-ts/billing-request-error';
import { BillingScreenView } from '@libs/billing-client-ts/billing-screen-view';
import type {
  BillingView,
  BillingViewInput,
} from '@libs/billing-client-ts/billing-view-model';
import {
  billingViewChangesAtMs,
  buildBillingView,
  CHECKOUT_CONFIRMING_MS,
} from '@libs/billing-client-ts/billing-view-model';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared-ts/plus-membership-offer';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { DAY, inputFor, NOW, PERIOD_END, row } from './billing-matrix';

const GRACE_MS = 7 * DAY;

const NO_ACTIONS: BillingActions = {
  subscribe: () => Promise.resolve(),
  manage: () => Promise.resolve(),
  unlock: () => undefined,
  checkAgain: () => undefined,
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

function account(patch: Partial<BillingViewInput>): BillingViewInput {
  return { ...inputFor('account', 'none', true, true), ...patch };
}

function statusText(): string {
  return screen.getByTestId(Handles.billingStatus).textContent ?? '';
}

describe('billing screen: before the membership is known', () => {
  // regression: billing-free-plan-flash-before-membership-loads
  test('a Plus member whose row has not loaded is never shown the free plan or a checkout', () => {
    const view = buildBillingView(account({ row: null, loading: true }));
    expect(view.state).toBe('loading');
    expect(view.primary).toBe('none');
    expect(view.manage).toBe(false);
    renderView(view);
    expect(screen.queryByText('Free plan')).toBeNull();
    expect(screen.queryByTestId(Handles.billingTier)).toBeNull();
    expect(screen.queryByTestId(Handles.billingSubscribe)).toBeNull();
    expect(statusText()).not.toContain('No membership yet.');
    expect(statusText()).toContain('Checking your membership');
    cleanup();
  });

  test('a row on the device is shown at once, loading or not', () => {
    const view = buildBillingView(
      account({ row: row('active'), loading: true })
    );
    expect(view.state).toBe('active');
    expect(view.tier).toBe('paid');
  });

  test('loading says nothing to someone who may not manage billing', () => {
    const view = buildBillingView({
      ...inputFor('guest', 'none', true, false),
      loading: true,
    });
    expect(view.state).toBe('none');
    expect(view.primary).toBe('unlock');
  });
});

describe('billing screen: back from paying at checkout', () => {
  // regression: billing-checkout-return-shows-no-membership
  test('before the membership shows, the payment is being confirmed and no second checkout is offered', () => {
    const view = buildBillingView(account({ checkoutReturnedAtMs: NOW }));
    expect(view.state).toBe('none');
    expect(view.notice).toBe('confirming');
    expect(view.primary).toBe('none');
    expect(view.checkAgain).toBe(false);
    renderView(view);
    expect(screen.queryByTestId(Handles.billingSubscribe)).toBeNull();
    expect(
      screen.getByTestId(Handles.billingNotice).getAttribute('data-notice')
    ).toBe('confirming');
    expect(screen.getByTestId(Handles.billingNotice).textContent).toContain(
      'Confirming your payment'
    );
    cleanup();
  });

  test('after the wait it may have gone through: check again before paying again', () => {
    const returnedAt = NOW - CHECKOUT_CONFIRMING_MS;
    const view = buildBillingView(
      account({ checkoutReturnedAtMs: returnedAt })
    );
    expect(view.notice).toBe('unconfirmed');
    expect(view.checkAgain).toBe(true);
    expect(view.primary).toBe('subscribe');
    renderView(view);
    expect(screen.getByTestId(Handles.billingNotice).textContent).toContain(
      'Check again before paying again'
    );
    expect(screen.getByTestId(Handles.billingCheckAgain)).toBeTruthy();
    cleanup();
  });

  test('the screen looks again the moment the wait is over', () => {
    expect(billingViewChangesAtMs(account({ checkoutReturnedAtMs: NOW }))).toBe(
      NOW + CHECKOUT_CONFIRMING_MS
    );
  });

  test('a new membership ends the wait', () => {
    const view = buildBillingView(
      account({ checkoutReturnedAtMs: NOW, row: row('trialing') })
    );
    expect(view.notice).toBeNull();
    expect(view.state).toBe('trialing');
  });

  test('an ended member subscribing again waits for the new membership too', () => {
    const view = buildBillingView({
      ...inputFor('account', 'ended', true, true),
      checkoutReturnedAtMs: NOW,
    });
    expect(view.notice).toBe('confirming');
    expect(view.primary).toBe('none');
  });
});

describe('billing screen: the free trial', () => {
  // regression: billing-trial-days-left-plural
  test('a trial with one day left says "1 day left"', () => {
    const endsTomorrow = new Date(NOW + DAY).toISOString();
    const view = buildBillingView(
      account({ row: row('trialing', false, endsTomorrow) })
    );
    expect(view.daysLeft).toBe(1);
    renderView(view);
    expect(statusText()).toContain('(1 day left)');
    expect(statusText()).not.toContain('days left');
    cleanup();
  });

  test('a trial with several days left counts them in the plural', () => {
    renderView(buildBillingView(account({ row: row('trialing') })));
    expect(statusText()).toContain('(10 days left)');
    cleanup();
  });
});

describe('billing screen: the last day of paid access', () => {
  const accessEnd = Date.parse(PERIOD_END) + GRACE_MS;
  const accessDay = new Date(accessEnd).toISOString().slice(0, 10);

  // regression: billing-access-date-omits-grace
  test('a canceled membership keeps paid access through grace, and says so', () => {
    const view = buildBillingView(
      account({ row: row('active', true), graceMs: GRACE_MS })
    );
    expect(view.accessEndsMs).toBe(accessEnd);
    renderView(view);
    expect(statusText()).toContain(`Plus access until ${accessDay}`);
    expect(
      screen.getByTestId(Handles.billingStatus).getAttribute('data-access-end')
    ).toBe(new Date(accessEnd).toISOString());
    cleanup();
  });

  test('a failed payment keeps paid access through grace, and says so', () => {
    const view = buildBillingView(
      account({ row: row('delinquent'), graceMs: GRACE_MS })
    );
    renderView(view);
    expect(statusText()).toContain(
      `Payment failed · Plus access until ${accessDay}`
    );
    cleanup();
  });

  test('an ended membership inside grace says when its paid access stops', () => {
    const endedYesterday = new Date(NOW - DAY).toISOString();
    const view = buildBillingView(
      account({ row: row('ended', false, endedYesterday), graceMs: GRACE_MS })
    );
    expect(view.tier).toBe('paid');
    renderView(view);
    const day = new Date(NOW - DAY + GRACE_MS).toISOString().slice(0, 10);
    expect(statusText()).toContain(`Plus access until ${day}`);
    cleanup();
  });

  test('past grace, or renewing, no last day is told', () => {
    const longAgo = new Date(NOW - 30 * DAY).toISOString();
    for (const membership of [row('ended', false, longAgo), row('active')]) {
      const view = buildBillingView(
        account({ row: membership, graceMs: GRACE_MS })
      );
      expect(view.accessEndsMs).toBeNull();
      renderView(view);
      expect(statusText()).not.toContain('access until');
      cleanup();
    }
  });

  test('a refunded membership with no period end says only that it ended', () => {
    const view = buildBillingView(
      account({ row: row('ended', false, null as unknown as string) })
    );
    renderView(view);
    expect(statusText()).toBe('Membership ended');
    cleanup();
  });
});

describe('billing screen: why opening checkout failed', () => {
  async function failedWith(error: Error): Promise<HTMLElement> {
    renderView(buildBillingView(account({})), {
      ...NO_ACTIONS,
      subscribe: () => Promise.reject(error),
    });
    fireEvent.click(screen.getByTestId(Handles.billingSubscribe));
    return await screen.findByTestId(Handles.billingActionFailure);
  }

  // regression: billing-checkout-failure-generic-copy
  test('an unreachable payment provider says nothing was charged and to try again', async () => {
    const failure = await failedWith(
      new BillingRequestError(
        'provider_unavailable',
        'billing checkout failed (503)'
      )
    );
    expect(failure.getAttribute('data-failure')).toBe('provider_unavailable');
    expect(failure.textContent).toContain("can't be reached right now");
    expect(failure.textContent).toContain('Nothing was charged');
    cleanup();
  });

  test('an account that already has a membership is told so', async () => {
    const failure = await failedWith(
      new BillingRequestError('has_membership', 'billing checkout failed (409)')
    );
    expect(failure.textContent).toContain('already has a membership');
    expect(screen.getByTestId(Handles.billingSubscribe).textContent).toContain(
      'You already have a membership'
    );
    cleanup();
  });

  test('any other failure keeps the plain retry face', async () => {
    renderView(buildBillingView(account({})), {
      ...NO_ACTIONS,
      subscribe: () => Promise.reject(new Error('boom')),
    });
    fireEvent.click(screen.getByTestId(Handles.billingSubscribe));
    await screen.findByText("Couldn't open checkout");
    expect(screen.queryByTestId(Handles.billingActionFailure)).toBeNull();
    cleanup();
  });
});
