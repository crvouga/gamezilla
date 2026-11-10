import { expect, test } from 'bun:test';
import { UserObservatory } from '@libs/observatory-server-ts/user-observatory';
import {
  LIVE_ONLINE_WINDOW_MS,
  LIVE_WATCH_LEASE_MS,
} from '@libs/observatory-shared-ts/live-session';
import { observatoryFixture } from './observatory-fixture';

const BROWSING = { place: 'spaces', activity: 'browsing', game: null } as const;

async function liveFixture() {
  const f = await observatoryFixture();
  const live = new UserObservatory(f.db, f.ports);
  const person = { accountId: f.createId(), deviceId: f.createId() };
  const bot = { accountId: f.createId(), deviceId: f.createId() };
  const botUserId = f.createId();
  f.syntheticUsers.set(bot.accountId, { id: botUserId, paused: false });
  return { f, live, person, bot, botUserId };
}

test('the Synthetic Population, never the app, decides who is a Synthetic User', async () => {
  const { f, live, person, bot, botUserId } = await liveFixture();
  try {
    await live.heartbeat(person, BROWSING);
    await live.heartbeat(bot, {
      place: 'space',
      activity: 'playing',
      game: 'Connect Four',
    });
    const everyone = await live.onlineNow('everyone');
    expect(
      everyone.map((entry) => [entry.accountId, entry.kind]).sort()
    ).toEqual(
      [
        [person.accountId, 'person'],
        [bot.accountId, 'synthetic'],
      ].sort()
    );
    expect(
      everyone.find((entry) => entry.kind === 'synthetic')?.syntheticUserId
    ).toBe(botUserId);
    expect(
      (await live.onlineNow('people')).map((entry) => entry.accountId)
    ).toEqual([person.accountId]);
    expect(
      (await live.onlineNow('synthetic')).map((entry) => entry.accountId)
    ).toEqual([bot.accountId]);
  } finally {
    await f.db.disconnect();
  }
});

test('closing the app or going quiet ends being online now', async () => {
  const { f, live, person, bot } = await liveFixture();
  try {
    await live.heartbeat(person, BROWSING);
    await live.heartbeat(bot, BROWSING);
    await live.end(person);
    expect(
      (await live.onlineNow('everyone')).map((entry) => entry.accountId)
    ).toEqual([bot.accountId]);
    f.clock.advance(LIVE_ONLINE_WINDOW_MS + 1);
    expect(await live.onlineNow('everyone')).toEqual([]);
    expect(f.notices().filter((n) => n === 'presence').length).toBe(3);
    // Coming back is arriving again.
    await live.heartbeat(person, BROWSING);
    expect(
      (await live.onlineNow('everyone')).map((entry) => entry.accountId)
    ).toEqual([person.accountId]);
  } finally {
    await f.db.disconnect();
  }
});

test('an app sends its screen only while watched, and each watch is recorded once', async () => {
  const { f, live, person } = await liveFixture();
  try {
    await live.heartbeat(person, BROWSING);
    const frame = { html: '<body><p>Spaces</p></body>', capturedAtMs: 1 };
    expect(await live.frame(person, frame)).toBe(false);
    const [entry] = await live.onlineNow('everyone');
    const watcher = f.createId();
    const first = await live.watch(entry!.sessionId, watcher);
    expect(first).toMatchObject({ online: true, frame: null });
    expect(f.notices()).toContain(`wake:${person.accountId}`);
    expect(await live.heartbeat(person, BROWSING)).toEqual({ watched: true });
    expect(await live.frame(person, frame)).toBe(true);
    const second = await live.watch(entry!.sessionId, watcher);
    expect(second.online && second.frame?.html).toBe(frame.html);
    expect(f.watchesStarted()).toEqual([
      {
        actorId: watcher,
        sessionId: entry!.sessionId,
        watchedAccountId: person.accountId,
      },
    ]);
    f.clock.advance(LIVE_WATCH_LEASE_MS + 1);
    expect(await live.frame(person, frame)).toBe(false);
  } finally {
    await f.db.disconnect();
  }
});

test('watching someone who is no longer online now says so', async () => {
  const { f, live, person } = await liveFixture();
  try {
    await live.heartbeat(person, BROWSING);
    const [entry] = await live.onlineNow('everyone');
    await live.end(person);
    expect(await live.watch(entry!.sessionId, f.createId())).toEqual({
      online: false,
    });
  } finally {
    await f.db.disconnect();
  }
});
