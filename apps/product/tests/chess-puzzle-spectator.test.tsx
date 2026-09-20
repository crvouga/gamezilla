// goal:chess-puzzles:12
// goal:always-true:7
import { describe, expect, test } from 'bun:test';
import type { Square } from '@pkgs/chess-board/chess-board-types';
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
  pickWrongUci,
  playUntilSolved,
  readActivePuzzleId,
  readGameLogRowTitle,
  readPuzzleDebug,
  readPuzzleDisplayFen,
  readPuzzleSpectator,
  readPuzzleStatus,
  readStatsElo,
  suggestPuzzleMove,
} from '../src/sim';
import { aliceUsername } from '../src/test/fixtures/fixtures';
import { setupFriendsPair } from '../src/test/fixtures/setup-friends-pair';
import { openSim } from '../src/test/setup/open-sim';

const DEFAULT_ELO = 1500;
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
  test('a guest spectates: no driving, suggestions broadcast, host move clears them', async () => {
    await using s = await openSim('chess-puzzle-spectator-arrows');
    await setupFriendsPair(s);

    await s.apply(createSpace, 'alice');
    await s.apply(openLobbyCard, 'bob', aliceUsername);
    await s.apply(joinFromPrompt, 'bob');

    await s.apply(openPuzzleFromSpace, 'alice');
    const host = required(
      await s.read(readPuzzleSpectator, 'alice'),
      'host probe'
    );
    const hostDebug = required(
      await s.read(readPuzzleDebug, 'alice'),
      'host debug'
    );

    await s.apply(focusActor, 'bob');
    await s.until((surf) => readPuzzleStatus(surf, 'bob'), {
      maxMs: 15_000,
      stepMs: 250,
      pred: (status) => status === 'solving',
    });
    const guest = required(
      await s.read(readPuzzleSpectator, 'bob'),
      'guest probe'
    );
    expect(host.spectating).toBe(false);
    expect(host.role).toBe('host');
    expect(hostDebug.interactive).toBe(true);
    expect(guest.spectating).toBe(true);
    expect(guest.role).toBe('guest');

    // A spectator's board is a suggestion surface, not a driving one.
    const guestDebug = required(
      await s.read(readPuzzleDebug, 'bob'),
      'guest debug'
    );
    expect(guestDebug.interactive).toBe(false);
    const displayFen = required(
      await s.read(readPuzzleDisplayFen, 'bob'),
      'display fen'
    );
    const suggested = pickWrongUci(displayFen, guestDebug.solutionUci);
    const suggestedFrom = suggested.slice(0, 2) as Square;
    const suggestedTo = suggested.slice(2, 4) as Square;
    await s.apply(suggestPuzzleMove, 'bob', suggestedFrom, suggestedTo);
    await s.apply(focusActor, 'alice');
    expect(await s.read(readPuzzleStatus, 'alice')).toBe('solving');
    const withSuggestion = required(
      await s.read(readPuzzleSpectator, 'alice'),
      'host probe after suggestion'
    );
    expect(withSuggestion.recommendations).toHaveLength(1);
    expect(withSuggestion.recommendations[0]?.from).toBe(suggestedFrom);
    expect(withSuggestion.recommendations[0]?.to).toBe(suggestedTo);

    await s.apply(playUntilSolved, 'alice');
    await s.apply(focusActor, 'bob');
    const afterSolve = required(
      await s.read(readPuzzleSpectator, 'bob'),
      'guest probe after solve'
    );
    expect(afterSolve.recommendations).toHaveLength(0);
  });
});
