import { describe, expect, test } from 'bun:test';
import { joinViaLink } from '@libs/spaces-harness-ts/space-actions';
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
      scheduler: { virtual: true, starvedAdvances: () => 0 },
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

/**
 * A live page, read one look at a time: the loading shell for the first
 * `shellReads` reads, then the join prompt still opening (nothing to act
 * on) until `advanceTime` has run `openingPolls` times, then Join. After a
 * press on Join, Bob is inside.
 */
function liveLinkOpening(shellReads: number, openingPolls: number) {
  let reads = 0;
  let polls = 0;
  let joined = false;
  const taps: string[] = [];
  const shown = (): ReadonlySet<string> => {
    if (joined) return new Set([Handles.spaceChromeOverflow]);
    if (reads <= shellReads)
      return new Set([Handles.spaceChromeOverflow, Handles.spaceLoading]);
    if (polls < openingPolls) return new Set();
    return new Set([Handles.spaceJoin]);
  };
  const ui = {
    get: (handle: string) => ({
      isVisible: () => {
        reads += 1;
        return Promise.resolve(shown().has(handle));
      },
      expect: { hidden: () => Promise.resolve() },
      tap: () => {
        taps.push(handle);
        if (handle === Handles.spaceJoin) joined = true;
        return Promise.resolve();
      },
    }),
  };
  const s = {
    actors: new Map([['bob', { ui, openLink: () => Promise.resolve() }]]),
    session: {
      scheduler: { virtual: true, starvedAdvances: () => 0 },
      advanceTime: () => {
        polls += 1;
        return Promise.resolve();
      },
      waitForIdle: () => Promise.resolve(),
    },
  } as never;
  return { s, taps };
}

describe('a live page changes between two looks at it', () => {
  // regression: space-loading-shell-gone-between-reads
  test('a loading shell that gives way between reads is not being inside', async () => {
    // Read 1 (Join) and read 2 (the bar) see the loading shell; read 3, the
    // loading body, already sees the join prompt opening.
    const { s } = liveLinkOpening(2, 3);
    expect(await waitSpaceOutcome(s, 'bob', 'the link')).toBe(
      Handles.spaceJoin
    );
  });

  // regression: space-link-join-skipped-mid-opening
  test('joining from a link presses Join once the prompt has opened', async () => {
    const { s, taps } = liveLinkOpening(2, 3);
    await Promise.resolve(joinViaLink.act(s, 'bob', '/space/a'));
    expect(taps).toEqual([Handles.spaceJoin]);
  });
});
