import { setMultiplayerConnection } from '@libs/game-matchmaking-harness-ts/multiplayer-connection';
import {
  givenMultiplayerRating,
  pairGameOpponents,
} from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import { opponentSearchObservation } from '@libs/game-matchmaking-harness-ts/opponent-search-observation';
import {
  findGameOpponent,
  openFindingAnOpponent,
  stopSeekingOpponent,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import {
  defaultMatchChoice,
  matchChoiceOf,
} from '@libs/game-matchmaking-shared-ts/match-choice';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import { conformanceGameOf } from '../conformance-world';

const PEOPLE = ['alice', 'bob'] as const;
function choice(w: QuintHarnessWorld) {
  const game = conformanceGameOf(w.ctx.variant, w.ctx.title);
  const matched = game.shared.registration.capabilities.matchmaking;
  if (matched === undefined)
    throw new Error(`${game.label} offers no matchmaking`);
  return { gameId: game.shared.id, id: defaultMatchChoice(matched) };
}

bindQuintModel<QuintHarnessWorld>({
  model: 'opponent-search',
  traces: 16,
  maxSteps: 8,
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      const match = choice(w);
      for (const person of PEOPLE) {
        await w.s.apply(signInWithGoogle, person);
        await w.s.apply(createSpace, person);
        await w.s.apply(openFindingAnOpponent, person, match.gameId);
      }
      await w.s.apply(
        givenMultiplayerRating,
        'bob',
        matchChoiceOf(match.id)!.ratingPool,
        { rating: 1620, games: 20 }
      );
    },
    openFindingAnOpponent: (w, picks) =>
      w.s.apply(
        openFindingAnOpponent,
        String(picks['person']),
        choice(w).gameId
      ),
    seekOpponent: (w, picks) =>
      w.s.apply(
        findGameOpponent,
        String(picks['person']),
        choice(w).gameId,
        choice(w).id
      ),
    stopSeeking: (w, picks) =>
      w.s.apply(stopSeekingOpponent, String(picks['person'])),
    pairPeopleUp: async (w) => {
      await w.s.advanceTime(7_000);
      await w.s.apply(pairGameOpponents, 'alice', true);
    },
    loseConnection: (w, picks) =>
      w.s.apply(setMultiplayerConnection, String(picks['person']), false),
    connectionReturns: (w, picks) =>
      w.s.apply(setMultiplayerConnection, String(picks['person']), true),
  },
  observe: (w) => w.quiet.read(opponentSearchObservation, PEOPLE),
});
