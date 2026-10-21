/**
 * One try at opening the multiplayer link: find (or create) the person's own
 * space, then go there. It always ends — in the space, at the hosting limit,
 * or failed with a way to retry — and never waits past a deadline.
 */

import type { Decision } from '@pkgs/permissions-shared/decision';

/**
 * Opening needs only this device (its own space and a local write), so it
 * normally finishes at once; past this it is stuck, not slow.
 */
export const MULTIPLAYER_LINK_DEADLINE_MS = 10_000;

export type MultiplayerLinkOpening =
  | { readonly kind: 'opening' }
  | { readonly kind: 'spaceLimited'; readonly decision: Decision }
  | { readonly kind: 'failed' };

/** Where the link leads: the space to open, or the hosting limit's decision. */
export type MultiplayerLinkTarget =
  | { readonly kind: 'space'; readonly spaceId: string | undefined }
  | { readonly kind: 'spaceLimited'; readonly decision: Decision };

type DeadlineTimers = {
  readonly setTimeout: (fn: () => void, ms: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
};

export type MultiplayerLinkAttempt = {
  /** The local space query has answered: resolve the target and go. */
  readonly ready: () => void;
  /** Abandon this try (unmount or retry); nothing it started lands later. */
  readonly cancel: () => void;
};

export function startMultiplayerLinkAttempt(args: {
  readonly timers: DeadlineTimers;
  readonly resolveTarget: () => Promise<MultiplayerLinkTarget>;
  readonly openSpace: (spaceId: string) => void;
  readonly settle: (outcome: MultiplayerLinkOpening) => void;
}): MultiplayerLinkAttempt {
  let live = true;
  let started = false;
  const finish = (): boolean => {
    if (!live) return false;
    live = false;
    args.timers.clearTimeout(deadline);
    return true;
  };
  const fail = (): void => {
    if (finish()) args.settle({ kind: 'failed' });
  };
  const deadline = args.timers.setTimeout(fail, MULTIPLAYER_LINK_DEADLINE_MS);
  args.settle({ kind: 'opening' });
  return {
    ready: () => {
      if (started || !live) return;
      started = true;
      void args.resolveTarget().then((target) => {
        if (target.kind === 'spaceLimited') {
          if (finish()) args.settle(target);
          return;
        }
        const spaceId = target.spaceId;
        if (spaceId === undefined || spaceId.length === 0) {
          fail();
          return;
        }
        if (finish()) args.openSpace(spaceId);
      }, fail);
    },
    cancel: () => {
      finish();
    },
  };
}
