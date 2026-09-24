/**
 * Shapes shared by every critical journey and both of its runners: the sim
 * proof in `bun check` and the production health probe.
 */

import type { HttpClient } from '@pkgs/http-client';
import type { Driver } from '@pkgs/ui-testing';

/** The state a runner puts the app in before {@link CriticalJourney.run}. */
export type JourneyAccess = 'anonymous' | 'signed-in';

/**
 * What only a real browser can offer: the pages a journey opens outside the
 * app (an identity provider's popup) and plain HTTP to follow them.
 */
export type JourneyBrowser = {
  /** API origin the web client talks to, e.g. `https://api.example.com`. */
  readonly apiOrigin: string;
  readonly http: HttpClient;
  /**
   * Resolve with the URL of the first popup the page opened whose URL
   * satisfies `match`; reject after `timeoutMs`.
   */
  waitForPopup(
    match: (url: string) => boolean,
    timeoutMs: number
  ): Promise<string>;
};

export type JourneyContext = {
  /** The app, driven by `data-testid` as a person would use it. */
  readonly ui: Driver;
  /** Unique per run: seeds values a journey writes, so runs never collide. */
  readonly runId: string;
  /** Present only when the runner drives a real browser. */
  readonly browser: JourneyBrowser | null;
};

/** A user flow that must never break. */
export type CriticalJourney = {
  /** Stable kebab-case id: report names and alert titles. */
  readonly id: string;
  /** What a person accomplishes, in one sentence. */
  readonly title: string;
  readonly access: JourneyAccess;
  /** Needs {@link JourneyContext.browser} (leaves the app for a real IdP). */
  readonly requiresBrowser: boolean;
  /**
   * Starts on the tab shell in {@link access}; throws on the first broken step.
   * Journeys that write clean up after themselves, even when they fail.
   */
  run(ctx: JourneyContext): Promise<void>;
};
