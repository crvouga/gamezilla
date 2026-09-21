import { t } from '@lingui/core/macro';
import type { DenialReason } from '@pkgs/permissions';

/**
 * The only registry of unlock / upsell copy (§22.5): policy config names copy
 * by key (`titleKey`, `bodyKey`, `ctaTarget`), this maps keys to Lingui
 * messages. Unknown keys fall back to the reason's neutral copy.
 */
const COPY: Readonly<Record<string, () => string>> = {
  'unlock.rated.limit.title': () => t`You've hit today's puzzle limit`,
  'unlock.rated.limit.body': () =>
    t`Upgrade for unlimited puzzles, or come back tomorrow.`,
};

const CTA: Readonly<Record<string, () => string>> = {
  billing: () => t`See plans`,
  signup: () => t`Create an account`,
};

/** Where a config `ctaTarget` navigates (app routes). */
const CTA_ROUTE: Readonly<Record<string, string>> = {
  billing: '/more/billing',
  signup: '/more/account',
};

export function unlockCtaRoute(target: string): string | undefined {
  return CTA_ROUTE[target];
}

const REASON_TITLE: Readonly<Record<DenialReason, () => string>> = {
  quota_exhausted: () => t`You've used this for now`,
  not_granted: () => t`Not available`,
  requires_account: () => t`Sign in to continue`,
  restricted: () => t`Not available on this account`,
};

export function unlockCopy(key: string | undefined): string | undefined {
  return key === undefined ? undefined : COPY[key]?.();
}

export function unlockCtaLabel(target: string | undefined): string | undefined {
  return target === undefined ? undefined : CTA[target]?.();
}

export function denialReasonTitle(reason: DenialReason | undefined): string {
  return REASON_TITLE[reason ?? 'not_granted']();
}

/** "Resets in 4 h" / "Resets in 12 min" for a decision's `resetsAtMs`. */
export function resetsInLabel(resetsAtMs: number, nowMs: number): string {
  const minutes = Math.max(1, Math.ceil((resetsAtMs - nowMs) / 60_000));
  if (minutes < 60) return t`Resets in ${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  return t`Resets in ${hours} h`;
}
