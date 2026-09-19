import { zValidator } from '@hono/zod-validator';
import type {
  Membership,
  MembershipChange,
  MembershipStatus,
  PlusMembershipOffer,
} from '@pkgs/billing';
import type { Clock } from '@pkgs/clock';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid/create-id';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';

import { MOCK_BILLING_TEST_IDS } from '../../../public/mock-test-ids';
import type { BillingNotify } from '../../../shared/routes/billing-route-deps';
import { applyMembershipChange } from '../../apply-subscription-state/server/apply-membership-change';

export type BillingMockDeps = {
  readonly getSqlClient: () => SqlClient;
  readonly offer: PlusMembershipOffer;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly notifyUser: BillingNotify;
};

const OBSERVE_KINDS = [
  'period_end',
  'payment_failed',
  'payment_recovered',
  'cancel_at_period_end',
  'resume',
  'cancel_now',
  'switch_interval',
  'payment_incomplete',
  'payment_expired',
] as const;

type ObserveKind = (typeof OBSERVE_KINDS)[number];

const checkoutPostSchema = z.object({
  accountId: z.string().min(1),
  returnUrl: z.url(),
  action: z.literal('pay'),
});

const portalPostSchema = z.object({
  accountId: z.string().min(1),
  returnUrl: z.url(),
  action: z.string().min(1),
});

const observeSchema = z.object({
  accountId: z.string().min(1),
  kind: z.enum(OBSERVE_KINDS),
});

type MembershipRow = {
  readonly provider: string;
  readonly provider_subscription_id: string;
  readonly price_key: string | null;
  readonly status: string;
  readonly current_period_end: string | null;
  readonly cancel_at_period_end: number | boolean | null;
};

/** The account's current projection row, normalized. */
type Current = {
  readonly provider: string;
  readonly subscriptionId: string;
  readonly offerPriceKey: string | null;
  readonly status: MembershipStatus;
  readonly periodEndMs: number | null;
  readonly endsAtPeriodEnd: boolean;
};

const MEMBERSHIP_STATUSES: Readonly<Record<string, MembershipStatus>> = {
  incomplete: 'incomplete',
  trialing: 'trialing',
  active: 'active',
  delinquent: 'delinquent',
  ended: 'ended',
};

/** Unknown persisted statuses fail closed to `ended`. */
function asMembershipStatus(value: string): MembershipStatus {
  return MEMBERSHIP_STATUSES[value] ?? 'ended';
}

const DAY_S = 24 * 60 * 60;
/** Fixed lengths so a test that advances one interval lands on the period end. */
const MONTH_S = 30 * DAY_S;
const YEAR_S = 365 * DAY_S;

function intervalSeconds(offer: PlusMembershipOffer, priceKey: string): number {
  return offer.prices[priceKey]?.interval === 'year' ? YEAR_S : MONTH_S;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatAmount(unitAmount: number, currency: string): string {
  return `${(unitAmount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

async function readCurrent(
  sqlClient: SqlClient,
  accountId: string
): Promise<Current | null> {
  const rows = await sqlClient.query(sql<MembershipRow>`
    SELECT provider, provider_subscription_id, price_key, status,
           current_period_end, cancel_at_period_end
    FROM billing_subscriptions
    WHERE account_id = ${accountId} AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 1`);
  const row = rows[0];
  if (row === undefined) return null;
  const parsed =
    row.current_period_end === null
      ? Number.NaN
      : Date.parse(row.current_period_end);
  return {
    provider: row.provider,
    subscriptionId: row.provider_subscription_id,
    offerPriceKey: row.price_key,
    status: asMembershipStatus(row.status),
    periodEndMs: Number.isFinite(parsed) ? parsed : null,
    endsAtPeriodEnd:
      row.cancel_at_period_end === true || row.cancel_at_period_end === 1,
  };
}

function defaultPriceKeyOf(
  offer: PlusMembershipOffer,
  current: Current | null
): string {
  return current?.offerPriceKey ?? offer.defaultPriceKey;
}

function currentIsLive(current: Current | null): boolean {
  return current !== null && current.status !== 'ended';
}

type Derived = {
  readonly offerPriceKey: string | null;
  readonly membership: Membership;
  /** Set by a fresh checkout so a resubscribe lands on a new row. */
  readonly subscriptionId?: string;
};

/** Applies one derived change through the shared writer and pushes it. */
async function apply(args: {
  readonly deps: BillingMockDeps;
  readonly accountId: string;
  readonly current: Current | null;
  readonly derived: Derived;
}): Promise<MembershipChange> {
  const { deps, accountId, current, derived } = args;
  const change: MembershipChange = {
    provider: current?.provider ?? 'fake',
    customerId: `fake_cus_${accountId}`,
    subscriptionId:
      derived.subscriptionId ??
      current?.subscriptionId ??
      `fake_sub_${accountId}`,
    offerPriceKey: derived.offerPriceKey,
    membership: derived.membership,
  };
  await applyMembershipChange({
    sql: deps.getSqlClient(),
    clock: deps.clock,
    accountId,
    change,
  });
  await deps.notifyUser(accountId, 'billing:membership', [
    'billing_subscriptions',
  ]);
  return change;
}

function renewed(
  offer: PlusMembershipOffer,
  priceKey: string,
  now: number
): Membership {
  return {
    status: 'active',
    periodEndMs: now + intervalSeconds(offer, priceKey) * 1000,
    endsAtPeriodEnd: false,
  };
}

function samePeriod(
  current: Current,
  status: MembershipStatus,
  endsAtPeriodEnd: boolean
): Membership {
  return { status, periodEndMs: current.periodEndMs, endsAtPeriodEnd };
}

function checkoutChange(
  deps: BillingMockDeps,
  accountId: string,
  current: Current | null
): Derived {
  const priceKey = defaultPriceKeyOf(deps.offer, current);
  const spec = deps.offer.prices[priceKey];
  const trialDays = spec?.trialPeriodDays ?? 0;
  const now = deps.clock.now();
  const periodEndMs =
    trialDays > 0
      ? now + trialDays * DAY_S * 1000
      : now + intervalSeconds(deps.offer, priceKey) * 1000;
  return {
    offerPriceKey: priceKey,
    // A checkout after an ended membership is a new subscription, not a
    // resurrection of the old row.
    ...(current === null
      ? {}
      : { subscriptionId: `fake_sub_${accountId}_${String(now)}` }),
    membership: {
      status: trialDays > 0 ? 'trialing' : 'active',
      periodEndMs,
      endsAtPeriodEnd: false,
    },
  };
}

function portalChange(
  deps: BillingMockDeps,
  current: Current,
  action: string
): Derived {
  if (action === 'cancel') {
    return {
      offerPriceKey: current.offerPriceKey,
      membership: samePeriod(current, current.status, true),
    };
  }
  if (action === 'resume') {
    return {
      offerPriceKey: current.offerPriceKey,
      membership: samePeriod(current, current.status, false),
    };
  }
  const priceKey = action.startsWith('switch:') ? action.slice(7) : '';
  return {
    offerPriceKey: priceKey,
    membership: renewed(deps.offer, priceKey, deps.clock.now()),
  };
}

type ObserveDerivation = (args: {
  readonly deps: BillingMockDeps;
  readonly current: Current;
  readonly now: number;
  readonly priceKey: string;
}) => Derived;

/** How each `observe` kind derives the next membership from the current row. */
const OBSERVE_DERIVATIONS: Readonly<Record<ObserveKind, ObserveDerivation>> = {
  period_end: ({ deps, current, now, priceKey }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: current.endsAtPeriodEnd
      ? samePeriod(current, 'ended', true)
      : renewed(deps.offer, priceKey, now),
  }),
  payment_failed: ({ current }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: samePeriod(current, 'delinquent', current.endsAtPeriodEnd),
  }),
  payment_recovered: ({ deps, current, now, priceKey }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: renewed(deps.offer, priceKey, now),
  }),
  cancel_at_period_end: ({ current }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: samePeriod(current, current.status, true),
  }),
  resume: ({ current }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: samePeriod(current, current.status, false),
  }),
  cancel_now: ({ current, now }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: {
      status: 'ended',
      periodEndMs: now,
      endsAtPeriodEnd: false,
    },
  }),
  switch_interval: ({ deps, current, now }) => {
    const other = deps.offer.switchablePriceKeys.find(
      (key) => key !== current.offerPriceKey
    );
    if (other === undefined) {
      throw new Error('no alternative price to switch to');
    }
    return {
      offerPriceKey: other,
      membership: renewed(deps.offer, other, now),
    };
  },
  payment_incomplete: ({ current, now }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: {
      status: 'incomplete',
      periodEndMs: now,
      endsAtPeriodEnd: false,
    },
  }),
  payment_expired: ({ current, now }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: {
      status: 'ended',
      periodEndMs: now,
      endsAtPeriodEnd: false,
    },
  }),
};

/** The lifecycle driver: derive the next membership from the current row. */
function observeChange(
  deps: BillingMockDeps,
  current: Current,
  kind: ObserveKind
): Derived {
  return OBSERVE_DERIVATIONS[kind]({
    deps,
    current,
    now: deps.clock.now(),
    priceKey: defaultPriceKeyOf(deps.offer, current),
  });
}

function checkoutPageHtml(
  accountId: string,
  returnUrl: string,
  offer: PlusMembershipOffer
): string {
  const priceKey = offer.defaultPriceKey;
  const spec = offer.prices[priceKey];
  const price =
    spec === undefined ? '' : formatAmount(spec.unitAmount, spec.currency);
  return `<!doctype html><html><body>
<h1>${escapeHtml(offer.product.name)}</h1>
<p>${escapeHtml(price)} / ${escapeHtml(spec?.interval ?? '')}</p>
<form method="post" action="/api/billing/mock/checkout">
<input type="hidden" name="accountId" value="${escapeHtml(accountId)}">
<input type="hidden" name="returnUrl" value="${escapeHtml(returnUrl)}">
<button type="submit" name="action" value="pay" data-testid="${MOCK_BILLING_TEST_IDS.checkoutPay}">Pay</button>
</form>
<a href="${escapeHtml(returnUrl)}">Return</a>
</body></html>`;
}
function portalPageHtml(
  accountId: string,
  returnUrl: string,
  offer: PlusMembershipOffer
): string {
  const switches = offer.switchablePriceKeys
    .map(
      (key) =>
        `<button type="submit" name="action" value="switch:${escapeHtml(key)}" data-testid="${escapeHtml(MOCK_BILLING_TEST_IDS.portalSwitch(key))}">Switch to ${escapeHtml(offer.prices[key]?.interval ?? key)}</button>`
    )
    .join('\n');
  return `<!doctype html><html><body>
<h1>Manage ${escapeHtml(offer.product.name)}</h1>
<form method="post" action="/api/billing/mock/portal">
<input type="hidden" name="accountId" value="${escapeHtml(accountId)}">
<input type="hidden" name="returnUrl" value="${escapeHtml(returnUrl)}">
<button type="submit" name="action" value="cancel" data-testid="${MOCK_BILLING_TEST_IDS.portalCancel}">Cancel</button>
<button type="submit" name="action" value="resume" data-testid="${MOCK_BILLING_TEST_IDS.portalResume}">Resume</button>
${switches}
</form>
<a href="${escapeHtml(returnUrl)}">Return</a>
</body></html>`;
}

/**
 * The stateless fake provider's edge. Mounted only when the injected port is
 * the fake; unauthenticated by design — the caller is a browser page this same
 * server rendered, and these routes are never mounted in production.
 *
 * Every change derives from the request plus the account's current projection
 * row, so any API instance can serve it.
 */
export class BillingMockRoutes {
  constructor(private readonly deps: BillingMockDeps) {}

  build(): Hono {
    return new Hono()
      .get('/billing/mock/checkout', (c) => this.renderCheckout(c))
      .post(
        '/billing/mock/checkout',
        zValidator('form', checkoutPostSchema),
        async (c) => await this.pay(c, c.req.valid('form'))
      )
      .get('/billing/mock/portal', (c) => this.renderPortal(c))
      .post(
        '/billing/mock/portal',
        zValidator('form', portalPostSchema),
        async (c) => await this.portal(c, c.req.valid('form'))
      )
      .post(
        '/billing/mock/observe',
        zValidator('json', observeSchema),
        async (c) => await this.observe(c, c.req.valid('json'))
      );
  }

  private renderCheckout(c: Context): Response {
    const accountId = c.req.query('accountId') ?? '';
    const returnUrl = c.req.query('returnUrl') ?? '';
    return c.html(checkoutPageHtml(accountId, returnUrl, this.deps.offer));
  }

  private renderPortal(c: Context): Response {
    const accountId = c.req.query('accountId') ?? '';
    const returnUrl = c.req.query('returnUrl') ?? '';
    return c.html(portalPageHtml(accountId, returnUrl, this.deps.offer));
  }

  private async pay(
    c: Context,
    body: z.infer<typeof checkoutPostSchema>
  ): Promise<Response> {
    const current = await readCurrent(this.deps.getSqlClient(), body.accountId);
    if (!currentIsLive(current)) {
      await apply({
        deps: this.deps,
        accountId: body.accountId,
        current,
        derived: checkoutChange(this.deps, body.accountId, current),
      });
    }
    return c.redirect(body.returnUrl, 303);
  }

  private async portal(
    c: Context,
    body: z.infer<typeof portalPostSchema>
  ): Promise<Response> {
    const current = await readCurrent(this.deps.getSqlClient(), body.accountId);
    if (current === null) {
      return c.json({ error: 'No membership for this account' }, 404);
    }
    if (body.action.startsWith('switch:')) {
      const priceKey = body.action.slice(7);
      if (this.deps.offer.prices[priceKey] === undefined) {
        return c.json({ error: `Unknown price ${priceKey}` }, 400);
      }
    }
    const derived = portalChange(this.deps, current, body.action);
    await apply({
      deps: this.deps,
      accountId: body.accountId,
      current,
      derived,
    });
    return c.redirect(body.returnUrl, 303);
  }

  private async observe(
    c: Context,
    body: z.infer<typeof observeSchema>
  ): Promise<Response> {
    const current = await readCurrent(this.deps.getSqlClient(), body.accountId);
    if (current === null) {
      return c.json({ error: 'No membership for this account' }, 404);
    }
    if (body.kind === 'switch_interval') {
      const other = this.deps.offer.switchablePriceKeys.find(
        (key) => key !== current.offerPriceKey
      );
      if (other === undefined) {
        return c.json({ error: 'No alternative price to switch to' }, 400);
      }
    }
    const change = await apply({
      deps: this.deps,
      accountId: body.accountId,
      current,
      derived: observeChange(this.deps, current, body.kind),
    });
    return c.json(change, 200);
  }
}
