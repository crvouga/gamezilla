import { expect, test } from 'bun:test';
import { joinSpaceFromLink } from '@libs/spaces-harness-ts/space-link';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/** A guest's device shows one frame per poll, on each side of their Join tap. */
function invitation(
  actor: string,
  before: readonly string[],
  after: readonly string[]
) {
  let frames = before;
  let index = 0;
  const taps: string[] = [];
  const links: string[] = [];
  const ui = {
    get: (handle: string) => ({
      isVisible: () => Promise.resolve(handle === frames[index]),
      expect: { hidden: () => Promise.resolve() },
      tap: () => {
        taps.push(handle);
        frames = after;
        index = 0;
        return Promise.resolve();
      },
    }),
  };
  return {
    links,
    taps,
    s: {
      actors: new Map([
        [actor, { ui, openLink: (link: string) => links.push(link) }],
      ]),
      session: {
        scheduler: { virtual: true, starvedAdvances: () => 0 },
        advanceTime: () => {
          index = Math.min(index + 1, frames.length - 1);
        },
        waitForIdle: () => Promise.resolve(),
      },
    } as never,
  };
}

// regression: matched-watcher-space-link-outcome
test('Dave waits through the loading bar and the opening connection notice before joining Bob', async () => {
  const { s, links, taps } = invitation(
    'dave',
    [Handles.spaceClose, Handles.spacesNeedConnection, Handles.spaceJoin],
    [Handles.spaceJoinNotConfirmed, Handles.spaceActive]
  );
  expect(await joinSpaceFromLink(s, 'dave', '/space/bob', 'enter')).toEqual({
    opened: Handles.spaceJoin,
    afterJoin: Handles.spaceActive,
  });
  expect(links).toEqual(['/space/bob']);
  expect(taps).toEqual([Handles.spaceJoin]);
});

test('Carol sees why Alice’s invitation cannot admit her before a board is expected', async () => {
  const { s, taps } = invitation('carol', [Handles.spaceHostOffline], []);
  await expect(
    joinSpaceFromLink(s, 'carol', '/space/alice', 'enter')
  ).rejects.toThrow('carol opening the link (last saw space-host-offline)');
  expect(taps).toEqual([]);
});

test('a refusal after a single Join is distinct from a refusal on opening', async () => {
  const { s, taps } = invitation(
    'dave',
    [Handles.spaceJoin],
    [Handles.spaceJoinUnavailable]
  );
  await expect(
    joinSpaceFromLink(s, 'dave', '/space/bob', 'enter')
  ).rejects.toThrow(
    'dave after pressing Join (last saw space-join-unavailable)'
  );
  expect(taps).toEqual([Handles.spaceJoin]);
});

test('an ordinary attempt may settle on an offline invitation', async () => {
  const { s, taps } = invitation('carol', [Handles.spacesNeedConnection], []);
  expect(
    await joinSpaceFromLink(s, 'carol', '/space/alice', 'observe')
  ).toEqual({ opened: Handles.spacesNeedConnection });
  expect(taps).toEqual([]);
});

test('a guest already inside proceeds without pressing Join', async () => {
  const { s, taps } = invitation('carol', [Handles.spaceActive], []);
  expect(await joinSpaceFromLink(s, 'carol', '/space/alice', 'enter')).toEqual({
    opened: Handles.spaceActive,
  });
  expect(taps).toEqual([]);
});
