import {
  findChessOpponent,
  openMultiplayerChess,
} from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { pairChessOpponents } from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import {
  multiplayerText,
  multiplayerView,
} from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { MeasureContext } from '@pkgs/openslo-shared/registry';
import { bindObjectives } from '@pkgs/openslo-shared/registry';
import { openHarness } from '../open-chess-harness';

async function gameReadyTime(context: MeasureContext) {
  await using s = await openHarness('multiplayer-ready-objective');
  for (const actor of ['alice', 'bob']) await s.apply(signInWithGoogle, actor);
  await s.apply(findChessOpponent, 'alice');
  const beganAtMs = await s.read((world) => world.harness.clock.now());
  await s.apply(findChessOpponent, 'bob');
  await s.apply(pairChessOpponents);
  await s.until(
    async (world) => {
      const first = (await multiplayerView(world, 'alice')).game;
      const second = (await multiplayerView(world, 'bob')).game;
      return (
        first !== null &&
        second !== null &&
        JSON.stringify(first) === JSON.stringify(second) &&
        first.white_id !== first.black_id &&
        first.turn === first.white_id &&
        first.revision === 0
      );
    },
    { maxMs: 10_000 }
  );
  for (const actor of ['alice', 'bob']) {
    await s.apply(openMultiplayerChess, actor);
    await s.until(
      async (world) =>
        (await multiplayerText(world, actor, 'multiplayer-game')) !== null
    );
  }
  return {
    kind: 'samples' as const,
    samples: [
      {
        atMs: context.endMs,
        value: (await s.read((world) => world.harness.clock.now())) - beganAtMs,
      },
    ],
  };
}

bindObjectives({
  spec: 'multiplayer-ready',
  measure: { 'multiplayer-game-ready-time': gameReadyTime },
  nowMs: () => Date.UTC(2026, 9, 2),
});
