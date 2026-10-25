/**
 * Ending a space, for every game offering custom games: an unfinished
 * custom game is cancelled without a winner, a completed result is kept
 * verbatim, and a game between two bots leaves no bot wake behind. People
 * see the ended space instead of the game, so these are checked on the
 * shared session's reaction to the space ending.
 */

import { expect, test } from 'bun:test';
import { CustomGamesChanged } from '@libs/game-session-shared-ts/custom-game-commands';
import { withCustomGames } from '@libs/game-session-shared-ts/custom-game-definition';
import {
  BOT_CUSTOM_GAME_SIDE,
  type CustomGame,
  CustomGamesAttr,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';
import { SpaceEnded } from '@libs/spaces-shared-ts/space-log-messages';
import {
  CancelScheduleEffect,
  ScheduleEffect,
} from '@pkgs/room-root-shared-ts/builtin';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { forEveryGame } from '../game-suite';

forEveryGame(
  import.meta.path,
  (game) => {
    const session = withCustomGames(
      game.shared,
      createTurnGames([game.shared.registration])
    );
    const active: CustomGame = {
      ...newCustomGame(
        'friday-game',
        'alice',
        game.shared.registration.rules.initial()
      ),
      status: 'active',
      black: { kind: 'person', person: 'bob' },
      ready: ['white', 'black'],
      startedAt: 0,
      turnStartedAt: 0,
    };

    function endSpace(current: CustomGame): CustomGame {
      const result = session.reactToSpaceEvent?.(
        CustomGamesAttr({ current, history: [] }),
        {
          identity: 'alice',
          ts: 10_000,
          commandId: 'space-ending',
          random: () => 0,
          authority: true,
        },
        SpaceEnded({})
      );
      if (result == null) return current;
      if (!result.ok) throw new Error(JSON.stringify(result.error));
      const changed = result.events.find(CustomGamesChanged.is);
      if (changed === undefined) throw new Error('game ending has no outcome');
      const ended = changed.payload.games.current;
      if (ended === null) throw new Error('game ending erased its history');
      return ended;
    }

    // Demoted from custom-game-completion: the ended space has no game screen.
    // regression: custom-game-ended-space-unobservable
    test('ending a space cancels its unfinished game without a winner', () => {
      const result = endSpace(active);
      expect(result.status).toBe('cancelled');
      expect(result.outcome).toBe('cancelled');
      expect(result.endedAt).toBe(10_000);
    });

    // regression: custom-game-ended-space-unobservable
    test('ending a space preserves a completed result verbatim', () => {
      const completed: CustomGame = {
        ...active,
        status: 'completed',
        outcome: 'white wins by resignation',
        endedAt: 5_000,
      };
      expect(endSpace(completed)).toEqual(completed);
    });

    // regression: custom-game-ended-space-unobservable
    test('ending a two-bot game cancels it and leaves no bot wake', () => {
      const result = endSpace({
        ...active,
        white: BOT_CUSTOM_GAME_SIDE,
        black: BOT_CUSTOM_GAME_SIDE,
      });
      expect(result.status).toBe('cancelled');
      expect(result.outcome).toBe('cancelled');
      const state = CustomGamesAttr({ current: result, history: [] });
      for (const effects of [
        session.recoverEffects(state),
        session.recoverLocalEffects?.(state) ?? [],
      ]) {
        expect(effects.some(ScheduleEffect.is)).toBe(false);
        expect(effects.some(CancelScheduleEffect.is)).toBe(true);
      }
    });
  },
  ['two seats']
);
