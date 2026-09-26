/** @jsxImportSource solid-js */
/**
 * The hosted pages against a stubbed page API: what a person sees for a
 * checkout and a portal session, and where their choices send them.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { MockBillingEmbeddedPage } from '@pkgs/billing-mock-provider/embedded';
import {
  type CheckoutView,
  MOCK_BILLING_TEST_IDS,
  type PortalView,
} from '@pkgs/billing-mock-provider/shared';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';

const ORIGIN = 'http://billing.test';
const NOW = Date.UTC(2026, 8, 21);
const DAY = 86_400_000;

const BUSINESS = {
  name: 'Gamezilla Unlimited',
  product: { name: 'Unlimited', description: 'Unlimited access.' },
};

const MONTHLY = {
  id: 'price_m',
  lookupKey: 'subscription_monthly',
  nickname: 'Monthly',
  interval: 'month' as const,
  unitAmount: 700,
  currency: 'usd',
};
const YEARLY = {
  id: 'price_y',
  lookupKey: 'subscription_yearly',
  nickname: 'Yearly',
  interval: 'year' as const,
  unitAmount: 6000,
  currency: 'usd',
};

const CHECKOUT: CheckoutView = {
  business: BUSINESS,
  session: {
    id: 'cs_test_1',
    status: 'open',
    successUrl: 'http://app.test/done',
    cancelUrl: 'http://app.test/back',
    trialPeriodDays: 7,
    cardOptional: false,
  },
  prices: [MONTHLY, YEARLY],
  selectedPriceId: 'price_m',
  nowMs: NOW,
};

function portalView(subscription: PortalView['subscription']): PortalView {
  return {
    business: BUSINESS,
    returnUrl: 'http://app.test/billing',
    prices: [MONTHLY, YEARLY],
    subscription,
    paymentMethod: {
      brand: 'visa',
      last4: '4242',
      exp_month: 12,
      exp_year: 2034,
    },
    invoices: [],
    cancellationReasons: ['too_expensive', 'other'],
    nowMs: NOW,
  };
}

type Route = (method: string, path: string, body: unknown) => Response;

function stubFetch(route: Route) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const path = new URL(url).pathname;
    const body =
      typeof init?.body === 'string'
        ? (JSON.parse(init.body) as unknown)
        : null;
    calls.push({ method, path, body });
    return await Promise.resolve(route(method, path, body));
  };
  return { fetch, calls };
}

afterEach(cleanup);

describe('hosted checkout', () => {
  test('shows the plans and test cards, and pay goes to the success url', async () => {
    const { fetch, calls } = stubFetch((method) =>
      method === 'GET'
        ? Response.json(CHECKOUT)
        : Response.json({ redirectUrl: 'http://app.test/done' })
    );
    const visited: string[] = [];
    render(() => (
      <MockBillingEmbeddedPage
        fetch={fetch}
        navigate={(url) => visited.push(url)}
        url={`${ORIGIN}/c/pay/cs_test_1`}
      />
    ));
    await screen.findByTestId(MOCK_BILLING_TEST_IDS.checkoutPay);
    expect(
      screen.getByTestId(
        MOCK_BILLING_TEST_IDS.checkoutPlan('subscription_yearly')
      )
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(
        MOCK_BILLING_TEST_IDS.checkoutCard('pm_card_chargeDeclined')
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Try Unlimited free for 7 days')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(MOCK_BILLING_TEST_IDS.checkoutPay));
    await screen.findByText('Subscribed — returning…');
    expect(visited).toEqual(['http://app.test/done']);
    expect(calls.at(-1)).toEqual({
      method: 'POST',
      path: '/pages/api/checkout/cs_test_1/confirm',
      body: { price: 'price_m', paymentMethod: 'pm_card_visa' },
    });
  });

  test('a declined card shows the error and stays on the page', async () => {
    const { fetch } = stubFetch((method) =>
      method === 'GET'
        ? Response.json(CHECKOUT)
        : Response.json(
            {
              error: {
                type: 'card_error',
                code: 'card_declined',
                message: 'Your card was declined.',
              },
            },
            { status: 402 }
          )
    );
    const visited: string[] = [];
    render(() => (
      <MockBillingEmbeddedPage
        fetch={fetch}
        navigate={(url) => visited.push(url)}
        url={`${ORIGIN}/c/pay/cs_test_1`}
      />
    ));
    fireEvent.click(
      await screen.findByTestId(MOCK_BILLING_TEST_IDS.checkoutPay)
    );
    const error = await screen.findByTestId(
      MOCK_BILLING_TEST_IDS.checkoutError
    );
    expect(error).toHaveTextContent('Your card was declined.');
    expect(visited).toEqual([]);
    expect(screen.getByTestId(MOCK_BILLING_TEST_IDS.checkoutPay)).toBeEnabled();
  });

  test('a dead link says so without a retry', async () => {
    const { fetch } = stubFetch(() =>
      Response.json(
        {
          error: { type: 'invalid_request_error', message: 'No such session' },
        },
        { status: 404 }
      )
    );
    render(() => (
      <MockBillingEmbeddedPage
        fetch={fetch}
        navigate={() => undefined}
        url={`${ORIGIN}/c/pay/cs_gone`}
      />
    ));
    expect(await screen.findByText('Link expired')).toBeInTheDocument();
    expect(screen.queryByText('Try again')).toBeNull();
  });
});

describe('hosted portal', () => {
  test('a trialing subscription can be canceled or switched', async () => {
    const { fetch } = stubFetch(() =>
      Response.json(
        portalView({
          id: 'sub_1',
          status: 'trialing',
          priceId: 'price_m',
          currentPeriodEndMs: NOW + 7 * DAY,
          cancelAtPeriodEnd: false,
          trialEndMs: NOW + 7 * DAY,
          endedAtMs: null,
          openInvoice: null,
        })
      )
    );
    render(() => (
      <MockBillingEmbeddedPage
        fetch={fetch}
        navigate={() => undefined}
        url={`${ORIGIN}/p/session/bps_1`}
      />
    ));
    await screen.findByTestId(MOCK_BILLING_TEST_IDS.portalCancelStart);
    expect(screen.getByText('Free trial')).toBeInTheDocument();
    expect(
      screen.getByTestId(
        MOCK_BILLING_TEST_IDS.portalSwitchStart('subscription_yearly')
      )
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(MOCK_BILLING_TEST_IDS.portalReturn)
    ).toHaveAttribute('href', 'http://app.test/billing');
    expect(
      screen.getByTestId(MOCK_BILLING_TEST_IDS.portalInvoices)
    ).toBeInTheDocument();
  });

  test('no subscription has nothing to manage and no checkout link', async () => {
    const { fetch } = stubFetch(() => Response.json(portalView(null)));
    const { container } = render(() => (
      <MockBillingEmbeddedPage
        fetch={fetch}
        navigate={() => undefined}
        url={`${ORIGIN}/p/session/bps_1`}
      />
    ));
    expect(await screen.findByText('No subscriptions')).toBeInTheDocument();
    expect(
      screen.queryByTestId(MOCK_BILLING_TEST_IDS.portalCancelStart)
    ).toBeNull();
    const links = [...container.querySelectorAll('a')].map((a) =>
      a.getAttribute('href')
    );
    expect(links).toEqual(['http://app.test/billing']);
  });
});
