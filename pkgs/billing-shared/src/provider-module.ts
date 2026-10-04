/**
 * A payment provider, as a composition root sees it. Every provider package
 * (Stripe, Paddle, the mock) exports exactly one of these, with the same
 * shape, and composition roots only ever iterate a list of them: booting the
 * API, reconciling the offer on deploy and registering secrets are one loop
 * each, with no provider named. Adding, removing or swapping a provider is a
 * change to that list and to configuration — never to a branch.
 */
import type { Logger } from '@pkgs/logger-shared/logger';

import type { MembershipBilling } from './membership';
import type { PlusMembershipOffer } from './offer';

export type MembershipProviderFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/** One secret a provider reads, for the deployment's secret registry. */
export type MembershipProviderSecretDef = {
  readonly name: string;
  readonly hint: string;
  /**
   * Always true for a provider's secrets: no provider is required, so a
   * deployment configures whichever it bills through.
   */
  readonly optional: true;
  readonly pushToApiWorker: boolean;
  validate(input: {
    readonly secretValue: string;
    readonly fetch: MembershipProviderFetch;
  }): Promise<void>;
};

/** What a provider is built from. */
export type MembershipProviderEnv = {
  /** A secret or binding by name: trimmed, `null` when unset or blank. */
  readonly readSecret: (name: string) => Promise<string | null>;
  readonly offer: PlusMembershipOffer;
  readonly now: () => number;
  readonly fetch: MembershipProviderFetch;
};

export type MembershipProviderModule = {
  /** The id its adapter reports (`MembershipBilling.provider`). */
  readonly provider: string;
  readonly secrets: readonly MembershipProviderSecretDef[];
  /**
   * The adapter, or `null` when none of its credentials are set. Throws when
   * they are set only in part — a misconfiguration, never a degraded mode.
   */
  create(env: MembershipProviderEnv): Promise<MembershipBilling | null>;
  /**
   * Converges the offer onto the provider's catalog and points its webhooks
   * at `callbackUrl`; `null` when not configured. Absent for a provider whose
   * catalog is handed to it at boot (the mock).
   */
  reconcile?(
    env: MembershipProviderEnv & {
      readonly callbackUrl: string;
      readonly log: Logger;
    }
  ): Promise<Readonly<Record<string, unknown>> | null>;
};
