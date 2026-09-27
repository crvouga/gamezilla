/**
 * The host a critical journey (`specs/journeys/`) runs on. The same step
 * definitions (`libs/runtime/tests/steps/journeys.steps.ts`) drive the
 * simulated app in `bun check` and a real browser against production
 * (`@apps/product#health`); each runner supplies a {@link JourneyHost}.
 */

import type { HttpClient } from '@pkgs/http-client';
import type { Driver } from '@pkgs/ui-testing';

/** The state a host puts a fresh device in before the journey starts. */
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

/** Gestures against the app, driven by `data-testid` as a person would. */
export type JourneyGestures = (ui: Driver) => Promise<void>;

export type JourneyHost = {
  /** Unique per run: seeds values a journey writes, so runs never collide. */
  readonly runId: string;
  /** Present only when the host drives a real browser. */
  readonly browser: JourneyBrowser | null;
  /**
   * The app build under test shows its puzzles' answers to the driver (test
   * builds only). Production never ships them, so a journey that solves a
   * puzzle stops there as a host limit.
   */
  readonly showsPuzzleAnswers: boolean;
  /** Open the app on a fresh device in `access`; ends on the tab shell. */
  open(access: JourneyAccess): Promise<void>;
  /** Run `gestures` against the open app. */
  act(name: string, gestures: JourneyGestures): Promise<void>;
  /**
   * Undo a write when the scenario ends, also when a later step fails (a
   * live space left behind blocks the next run). {@link settle} drops it
   * once a step did the undo itself.
   */
  defer(key: string, cleanup: JourneyGestures): void;
  settle(key: string): void;
};

/** The world the journey steps need: every host's world carries one. */
export type JourneyWorld = { readonly journey: JourneyHost };
