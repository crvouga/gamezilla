import { pairGameOpponents } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import {
  multiplayerText,
  multiplayerView,
} from '@libs/game-matchmaking-harness/multiplayer-reads';
import { requestGameOpponent } from '@libs/game-matchmaking-harness/multiplayer-search-ui';
import {
  givenGameSpace,
  openFindingAnOpponent,
} from '@libs/game-matchmaking-harness/opponent-seeking';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { MeasureContext } from '@pkgs/openslo-shared/registry';
import { bindObjectives } from '@pkgs/openslo-shared/registry';
import { gamesHeldTo, openConformanceHarness } from '../conformance-world';

/** The clock choice both people seek at. */
const CLOCK_CHOICE = '5+0';

/**
 * The time, in `game`, from the second person seeking an opponent at the
 * same clock choice until both see their one matched game ready to play.
 */
async function gameReadyTime(game: HarnessGame, endMs: number) {
  await using s = await openConformanceHarness(
    `matched-game-ready-objective-${game.shared.id}`
  );
  for (const actor of ['alice', 'bob']) {
    await s.apply(signInWithGoogle, actor);
    await s.apply(givenGameSpace, actor);
    await s.apply(openFindingAnOpponent, actor, game.shared.id);
  }
  await s.apply(requestGameOpponent, 'alice', CLOCK_CHOICE);
  const beganAtMs = await s.read((world) => world.harness.clock.now());
  await s.apply(requestGameOpponent, 'bob', CLOCK_CHOICE);
  await s.apply(pairGameOpponents);
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
    await s.apply(openFindingAnOpponent, actor, game.shared.id);
    await s.until(
      async (world) =>
        (await multiplayerText(world, actor, 'multiplayer-game')) !== null
    );
  }
  return {
    atMs: endMs,
    value: (await s.read((world) => world.harness.clock.now())) - beganAtMs,
  };
}

async function readyTimes(context: MeasureContext) {
  const samples = [];
  for (const game of gamesHeldTo('specs/games/matched-game-ready.openslo.yaml'))
    samples.push(await gameReadyTime(game, context.endMs));
  return { kind: 'samples' as const, samples };
}

bindObjectives({
  spec: 'matched-game-ready',
  measure: { 'matched-game-ready-time': readyTimes },
  nowMs: () => Date.UTC(2026, 9, 2),
});
