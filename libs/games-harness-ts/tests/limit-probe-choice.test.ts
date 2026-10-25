import { expect, test } from 'bun:test';
import { offeredMatchChoices } from '@libs/game-matchmaking-shared-ts/match-choice';
import { HARNESS_GAMES } from '@libs/games-harness-ts/harness-games';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { limitProbeChoice } from './dmn/limit-probe-choice';

// regression: clockless-games-sought-at-a-clock-in-unfinished-game-limit
test('the unfinished-game-limit probe seeks every game at a choice it offers', () => {
  const rules = createTurnGames(
    HARNESS_GAMES.map((game) => game.shared.registration)
  );
  const offered = new Set(
    offeredMatchChoices(rules).map((choice) => choice.id)
  );
  for (const game of HARNESS_GAMES) {
    const matchmaking = game.shared.registration.capabilities.matchmaking;
    if (matchmaking !== undefined)
      expect(offered.has(limitProbeChoice(matchmaking))).toBe(true);
  }
});
