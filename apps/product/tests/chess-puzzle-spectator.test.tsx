import { describe, expect, test } from 'bun:test';
import {
  createSpace,
  focusActor,
  isGameLogEmpty,
  isPuzzleSolved,
  joinFromPrompt,
  leavePuzzleToChessMenu,
  openChessStatsScreen,
  openLobbyCard,
  openPuzzleFromSpace,
  playUntilSolved,
  readActivePuzzleId,
  readGameLogRowTitle,
  readStatsElo,
} from '../src/sim';
import { aliceUsername } from '../src/test/fixtures/fixtures';
import { setupFriendsPair } from '../src/test/fixtures/setup-friends-pair';
import { openSim } from '../src/test/setup/open-sim';

const DEFAULT_ELO = 1200;
/** Narrow a nullable read result; failing loudly beats a silent `!`. */
function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what}`);
  }
  return value;
}

describe('chess puzzle spectator', () => {
  test('a guest watching the host solve is not rated for it', async () => {
    await using s = await openSim('chess-puzzle-spectator');
    await setupFriendsPair(s);

    await s.apply(createSpace, 'alice');
    // `openLobbyCard` polls the lobby (re-opening the Spaces tab) for the card.
    await s.apply(openLobbyCard, 'bob', aliceUsername);
    await s.apply(joinFromPrompt, 'bob');

    await s.apply(openPuzzleFromSpace, 'alice');
    const puzzleId = required(
      await s.read(readActivePuzzleId, 'alice'),
      'active puzzle'
    );
    await s.apply(playUntilSolved, 'alice');
    // The room is shared: bob (focused so his tree is in the document) sees
    // the same solved board.
    await s.apply(focusActor, 'bob');
    await s.until((surf) => isPuzzleSolved(surf, 'bob'), { maxMs: 15_000 });

    // Chess screen is room state, so both land on Stats together.
    await s.apply(leavePuzzleToChessMenu, 'alice');
    await s.apply(openChessStatsScreen, 'alice');
    expect(await s.read(readGameLogRowTitle, 'alice', puzzleId)).toMatch(
      /^Solved/
    );

    await s.apply(focusActor, 'bob');
    await s.until((surf) => isGameLogEmpty(surf, 'bob'), { maxMs: 15_000 });
    expect(await s.read(readStatsElo, 'bob')).toBe(DEFAULT_ELO);
  });
});
