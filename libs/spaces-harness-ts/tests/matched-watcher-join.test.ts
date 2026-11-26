import { expect, test } from 'bun:test';
import { joinSpaceFromLink } from '@libs/spaces-harness-ts/space-link';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/** A guest's device shows one frame per poll, on each side of their Join tap. */
function invitation(
  actor: string,
  before: readonly string[],
  after: readonly string[],
  newDevice = false
) {
  let frames = before;
  let index = 0;
  const taps: string[] = [];
  const links: string[] = [];
  const launches: string[] = [];
  const ui = {
    get: (handle: string) => ({
      isVisible: () =>
        Promise.resolve(
          handle === Handles.spaceClose || handle === frames[index]
        ),
      expect: { hidden: () => Promise.resolve() },
      tap: () => {
        taps.push(handle);
        frames = after;
        index = 0;
        return Promise.resolve();
      },
    }),
  };
  const device = { ui, openLink: (link: string) => links.push(link) };
  return {
    links,
    launches,
    taps,
    s: {
      actors: new Map(newDevice ? [] : [[actor, device]]),
      runtime: {
        launchActor: async (_actor: string, path = '/') => {
          launches.push(path);
          return device;
        },
      },
      session: {
        ports: { ui: { kind: 'solid-dom' } },
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

// regression: finished-match-watcher-invitation-boot
test('Carol opens Alice’s finished Battleship game on first launch and joins once', async () => {
  const link = '/space/b20b88cb-801f-4eff-8c09-6e320313e673';
  const { s, links, launches, taps } = invitation(
    'carol',
    [Handles.spaceJoin],
    [Handles.spaceActive],
    true
  );
  expect(await joinSpaceFromLink(s, 'carol', link, 'enter')).toEqual({
    opened: Handles.spaceJoin,
    afterJoin: Handles.spaceActive,
  });
  expect(launches).toEqual([link]);
  expect(links).toEqual([]);
  expect(taps).toEqual([Handles.spaceJoin]);
});

test.each(['space-join-opening', 'space-join-checking-host'])(
  'Carol still waiting at %s has not been admitted',
  async (stage) => {
    const { s, taps } = invitation('carol', [stage], []);
    await expect(
      joinSpaceFromLink(s, 'carol', '/space/alice', 'enter')
    ).rejects.toThrow(`carol opening the link (last saw ${stage})`);
    expect(taps).toEqual([]);
  }
);
