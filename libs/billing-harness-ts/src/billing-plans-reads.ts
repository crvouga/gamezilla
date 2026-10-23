/**
 * Reads for what the billing plans tell a person: each plan's price as the
 * screen words it, which plan is marked current, the free trial offered and
 * the one under way, and the way back from a failed payment.
 */

import type { ProductHarness } from '@libs/harness-ts/harness';
import { accountIdOf } from '@libs/harness-ts/identity';
import { actorHtml, nodeText, visible } from '@libs/harness-ts/observations';
import { Handles } from '@libs/test-ids-shared-ts/handles';

import {
  providerPeriodEndMs,
  providerTrialEndMs,
} from './billing-provider-driver';

const DAY_MS = 24 * 60 * 60 * 1000;

/** One plan as the billing plans show it. */
export type PlanShown = {
  /** The price as shown, e.g. `$60.00`. */
  readonly amount: string;
  /** What the price is for: `month` or `year`. */
  readonly per: 'month' | 'year' | null;
  /** A yearly plan's price per month as shown, e.g. `$5.00`. */
  readonly perMonth: string | null;
  /** The saving the plan's badge shows, in percent. */
  readonly savingPercent: number | null;
  /** The plan is marked as the person's current plan. */
  readonly current: boolean;
};

function markedCurrent(html: string | null, priceKey: string): boolean {
  if (html === null) return false;
  const testId = Handles.billingPrice(priceKey);
  const tag = new RegExp(`<[^>]*\\sdata-testid="${testId}"[^>]*>`).exec(html);
  return tag !== null && /\saria-current="true"/.test(tag[0]);
}

function perOf(terms: string | null): PlanShown['per'] {
  if (terms?.startsWith('per month') === true) return 'month';
  if (terms?.startsWith('per year') === true) return 'year';
  return null;
}

/** The plan with offer price `priceKey`, or `null` while it is not shown. */
export async function planShown(
  s: ProductHarness,
  actorId: string,
  priceKey: string
): Promise<PlanShown | null> {
  const tile = Handles.billingPrice(priceKey);
  const amount = await nodeText(s, actorId, [tile, Handles.billingPriceAmount]);
  if (amount === null) return null;
  const terms = await nodeText(s, actorId, [tile, Handles.billingPriceTerms]);
  const saving = (await visible(s, actorId, [tile, Handles.billingPriceSaving]))
    ? await nodeText(s, actorId, [tile, Handles.billingPriceSaving])
    : null;
  const percent = saving === null ? null : /(\d+)%/.exec(saving)?.[1];
  return {
    amount: amount.trim(),
    per: perOf(terms?.trim() ?? null),
    perMonth: /·\s*(\S+)\/month/.exec(terms ?? '')?.[1] ?? null,
    savingPercent:
      percent === undefined || percent === null ? null : Number(percent),
    current: markedCurrent(await actorHtml(s, actorId), priceKey),
  };
}

/** How many days of free trial the subscribe button offers, or `null`. */
export async function freeTrialOffered(
  s: ProductHarness,
  actorId: string
): Promise<number | null> {
  if (!(await visible(s, actorId, [Handles.billingSubscribe]))) return null;
  const label = await nodeText(s, actorId, [Handles.billingSubscribe]);
  const days = /(\d+)-day free trial/.exec(label ?? '')?.[1];
  return days === undefined ? null : Number(days);
}

/** A calendar day as `YYYY-MM-DD`, in the device's time zone. */
function dayOf(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The free trial under way, as the billing plans' status line tells it. */
export type FreeTrialShown = {
  /** The day the status line says the trial ends, as `YYYY-MM-DD`. */
  readonly endsOn: string | null;
  readonly daysLeft: number;
};

/** The free trial the status line tells of, or `null` when it tells none. */
export async function freeTrialShown(
  s: ProductHarness,
  actorId: string
): Promise<FreeTrialShown | null> {
  const status = await nodeText(s, actorId, [Handles.billingStatus]);
  const match = /Free trial · ends (.+) \((\d+) days? left\)/.exec(
    status ?? ''
  );
  if (match === null) return null;
  const endsMs = Date.parse(match[1] ?? '');
  return {
    endsOn: Number.isFinite(endsMs) ? dayOf(endsMs) : null,
    daysLeft: Number(match[2]),
  };
}

/** The day the provider ends the actor's free trial, as `YYYY-MM-DD`. */
export async function freeTrialEndDay(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const accountId = await accountIdOf(s, actorId);
  if (accountId === null) return null;
  const endMs = await providerTrialEndMs(s, accountId);
  return endMs === null ? null : dayOf(endMs);
}

/**
 * The last day of paid access the status line tells, as `YYYY-MM-DD`, or
 * `null` when it tells none.
 */
export async function paidAccessLastDayShown(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const status = await nodeText(s, actorId, [Handles.billingStatus]);
  const shown = /Plus access until (.+)$/.exec(status?.trim() ?? '')?.[1];
  if (shown === undefined) return null;
  const ms = Date.parse(shown);
  return Number.isFinite(ms) ? dayOf(ms) : null;
}

/**
 * The day `days` days after the provider's period end for the actor's
 * membership, as `YYYY-MM-DD`.
 */
export async function dayAfterPeriodEnd(
  s: ProductHarness,
  actorId: string,
  days: number
): Promise<string | null> {
  const accountId = await accountIdOf(s, actorId);
  if (accountId === null) return null;
  return dayOf((await providerPeriodEndMs(s, accountId)) + days * DAY_MS);
}

/** The billing plans offer to pay with a new card in the billing portal. */
export async function offeredNewCard(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  if (!(await visible(s, actorId, [Handles.billingManage]))) return false;
  const label = await nodeText(s, actorId, [Handles.billingManage]);
  return label?.includes('Update payment method') === true;
}
