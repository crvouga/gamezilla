import { expect, test } from 'bun:test';
import { BATTLESHIP_HARNESS_GAME } from '@libs/battleship-harness-ts/battleship-harness-game';
import { leaveGameSessionSpace } from '@libs/game-session-harness-ts/game-session-departure';
import { establishGameSession } from '@libs/game-session-harness-ts/game-session-lineup';
import { gameSessionView } from '@libs/game-session-harness-ts/game-session-probe';
import { configureGameSessionChoice } from '@libs/game-session-harness-ts/game-session-ui';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import { leaveSpace } from '@libs/spaces-harness-ts/space-actions';
import { openConformanceHarness } from './conformance-world';

const holdUpload = scenarioAction({
  name: 'holdLeaveUpload',
  act: (s, actor: string, delayMs?: number) => {
    s.harness.net.holdHttp(actor, '/api/mutations');
    if (delayMs !== undefined)
      s.session.ports.timers.setTimeout(
        () => s.harness.net.releaseHttp(actor, '/api/mutations'),
        delayMs
      );
  },
});
const releaseUpload = scenarioAction({
  name: 'releaseLeaveUpload',
  act: (s, actor: string) => s.harness.net.releaseHttp(actor, '/api/mutations'),
});

async function finishBattleship(
  s: Awaited<ReturnType<typeof openConformanceHarness>>
) {
  await s.apply(establishGameSession, BATTLESHIP_HARNESS_GAME.shared.id, {
    history: BATTLESHIP_HARNESS_GAME.fixtures.firstSideVictory,
  });
}

// regression: departed-rematch-before-space-membership
test("the rematch fixture waits for Bob's delayed departure to reach Alice", async () => {
  await using s = await openConformanceHarness();
  await finishBattleship(s);
  const bob = (await s.read(gameSessionView, 'bob')).myId;
  await s.apply(holdUpload, 'bob', 1_000);
  await s.apply(leaveGameSessionSpace, 'bob', 'alice');
  expect((await s.read(gameSessionView, 'alice')).members).not.toContain(bob);
  await s.apply(configureGameSessionChoice, 'alice', { operation: 'rematch' });
  const seen = await s.read(gameSessionView, 'alice');
  expect(seen.current?.white).toEqual({ kind: 'open', person: '' });
  expect(seen.current?.black).toEqual({ kind: 'person', person: seen.myId });
}, 120_000);

test("a Battleship rematch opens the departing player's seat when Leave arrives after the rematch", async () => {
  await using s = await openConformanceHarness();
  await finishBattleship(s);
  const before = (await s.read(gameSessionView, 'alice')).current;
  const bob = (await s.read(gameSessionView, 'bob')).myId;
  if (before === null) throw new Error('No Battleship game to rematch');
  expect(before.status).toBe('completed');
  expect(before.black).toEqual({ kind: 'person', person: bob });

  await s.apply(holdUpload, 'bob');
  let rematchId: string;
  try {
    await s.apply(leaveSpace, 'bob');
    await s.apply(configureGameSessionChoice, 'alice', {
      operation: 'rematch',
    });
    const rematch = await s.read(gameSessionView, 'alice');
    if (rematch.current === null) throw new Error('Alice sees no rematch');
    rematchId = rematch.current.id;
    expect(rematch.members).toContain(bob);
    expect(rematchId).not.toBe(before.id);
    expect(rematch.current.status).toBe('configuring');
    expect(rematch.current.moves).toEqual([]);
    expect(rematch.current.white).toEqual(before.black);
  } finally {
    await s.apply(releaseUpload, 'bob');
  }
  const settled = await s.until((world) => gameSessionView(world, 'alice'), {
    pred: (host) =>
      host.connected &&
      host.members.includes(host.myId) &&
      !host.members.includes(bob),
  });
  expect(settled.current?.id).toBe(rematchId);
  expect(settled.current?.white).toEqual({ kind: 'open', person: '' });
  expect(settled.current?.black).toEqual(before.white);
  expect(settled.history).toEqual([before]);
}, 120_000);
