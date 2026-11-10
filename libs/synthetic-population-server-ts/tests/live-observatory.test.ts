import { expect, test } from 'bun:test';
import { LiveObservatory } from '@libs/synthetic-population-server-ts/live-observatory';
import {
  LIVE_ONLINE_WINDOW_MS,
  LIVE_WATCH_LEASE_MS,
} from '@libs/synthetic-population-shared-ts/live-session';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { syntheticPopulationFixture } from './synthetic-population-fixture';

const BROWSING = { place: 'spaces', activity: 'browsing', game: null } as const;

async function liveFixture() {
  const f = await syntheticPopulationFixture();
  const live = new LiveObservatory(f.db, f.live);
  const person = { accountId: f.createId(), deviceId: f.createId() };
  const assignment = (await f.controller.claim(f.workers[0]!))!;
  const bot = { accountId: f.createId(), deviceId: f.createId() };
  await f.db.run(
    sql`UPDATE population_users SET account_id = ${bot.accountId} WHERE id = ${assignment.lease.userId}`
  );
  return { f, live, person, bot, botUserId: assignment.lease.userId };
}

test('the server, never the app, decides who is a Synthetic User', async () => {
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
    expect(f.liveNotices().filter((n) => n === 'presence').length).toBe(3);
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
    expect(f.liveNotices()).toContain(`wake:${person.accountId}`);
    expect(await live.heartbeat(person, BROWSING)).toEqual({ watched: true });
    expect(await live.frame(person, frame)).toBe(true);
    const second = await live.watch(entry!.sessionId, watcher);
    expect(second.online && second.frame?.html).toBe(frame.html);
    const audits = (await f.repo.events(null)).filter(
      (event) => event.event === 'LiveWatchStarted'
    );
    expect(audits).toHaveLength(1);
    expect(audits[0]?.context).toMatchObject({
      actorId: watcher,
      sessionId: entry!.sessionId,
    });
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
