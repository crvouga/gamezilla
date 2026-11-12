import { describe, expect, test } from 'bun:test';
import { waitSpaceOutcome } from '@libs/spaces-harness-ts/space-ui';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/**
 * Bob opens a space link on a device that is not in the space: the space's
 * loading shell (its bar, ⋯ included, over a loading body) shows first, for
 * `loadingPolls` polls, then the join prompt.
 */
function linkOpening(loadingPolls: number) {
  let polls = 0;
  const shown = (): ReadonlySet<string> =>
    polls < loadingPolls
      ? new Set([Handles.spaceChromeOverflow, Handles.spaceLoading])
      : new Set([Handles.spaceJoin]);
  const ui = {
    get: (handle: string) => ({
      isVisible: () => Promise.resolve(shown().has(handle)),
    }),
  };
  return {
    actors: new Map([['bob', { ui }]]),
    session: {
      scheduler: { starvedAdvances: () => 0 },
      advanceTime: () => {
        polls += 1;
        return Promise.resolve();
      },
      waitForIdle: () => Promise.resolve(),
    },
  } as never;
}

describe('a space link settles on what the person can do there', () => {
  // regression: space-loading-shell-reads-as-inside
  test("the loading shell's bar is not being inside the space", async () => {
    expect(await waitSpaceOutcome(linkOpening(3), 'bob', 'the link')).toBe(
      Handles.spaceJoin
    );
  });
});
