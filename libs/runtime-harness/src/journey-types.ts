/**
 * The host a critical journey (`specs/journeys/`) runs on. The same step
 * definitions (`libs/runtime-harness/src/journeys.steps.ts`) drive the
 * simulated app in `bun check` and a real browser against production
 * (`@apps/product#health`); each runner supplies a {@link JourneyHost}.
 */

import type { Driver } from '@pkgs/ui-testing-root-shared/driver';

/** The state a host puts a fresh device in before the journey starts. */
export type JourneyAccess = 'anonymous' | 'signed-in';

/**
 * What only a real browser can offer: following the current tab from the app
 * to the identity provider.
 */
export type JourneyBrowser = {
  /**
   * Origin Google sends people back to (`<origin>/api/auth/callback/google`):
   * the one OAuth callback relay every environment shares.
   */
  readonly oauthCallbackOrigin: string;
  /**
   * Resolve with the current tab URL once it satisfies `match`; reject after
   * `timeoutMs`.
   */
  waitForNavigation(
    match: (url: string) => boolean,
    timeoutMs: number
  ): Promise<string>;
};

/** Gestures against the app, driven by `data-testid` as a person would. */
export type JourneyGestures = (ui: Driver) => Promise<void>;

export type JourneyHost = {
  /** Unique per run: seeds values a journey writes, so runs never collide. */
  readonly runId: string;
  /** The host's clock, virtual in the harness and wall time in live checks. */
  now(): Promise<number>;
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
  /** Open the second person's fresh device with its own identity. */
  openPeer(access: JourneyAccess): Promise<void>;
  /** Run `gestures` against the open app. */
  act(name: string, gestures: JourneyGestures): Promise<void>;
  /**
   * A second person on their own fresh device, not the one who opened the
   * app. The first call opens that device. Gestures run there.
   */
  actAsGuest(name: string, gestures: JourneyGestures): Promise<void>;
  /**
   * The space link the open app is on (`/space/<id>`), what Copy link
   * hands out.
   */
  spaceLink(): Promise<string>;
  /** Open `link` (`/space/<id>`) on the guest's device. */
  openGuest(link: string): Promise<void>;
  /** This device has no connection to the app's servers. */
  offline(): Promise<void>;
  /** Restore this device's connection without clearing its storage. */
  online(): Promise<void>;
  /** Open the app again on the same device. Its storage stays. */
  reopen(): Promise<void>;
  /**
   * Undo a write when the scenario ends, also when a later step fails (a
   * live space left behind blocks the next run). {@link settle} drops it
   * once a step did the undo itself.
   */
  defer(key: string, cleanup: JourneyGestures): void;
  settle(key: string): void;
};

const SPACE_LINK = /\/space\/[^/?#]+/;

/** `/space/<id>` from an app route or a full URL — what Copy link hands out. */
export function spaceLinkFromLocation(location: string): string {
  const link = SPACE_LINK.exec(location)?.[0];
  if (link === undefined) {
    throw new Error(`the app is not on a space link (${location})`);
  }
  return link;
}

/** The world the journey steps need: every host's world carries one. */
export type JourneyWorld = { readonly journey: JourneyHost };
