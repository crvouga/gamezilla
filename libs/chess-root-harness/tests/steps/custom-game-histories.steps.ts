import {
  CUSTOM_GAME_BEFORE_CASTLING,
  CUSTOM_GAME_BEFORE_EN_PASSANT,
  CUSTOM_GAME_BEFORE_PROMOTION,
  CUSTOM_GAME_CASTLING_THROUGH_CHECK,
  CUSTOM_GAME_FIFTY,
  CUSTOM_GAME_FOOLS_MATE,
  CUSTOM_GAME_MATERIAL,
  CUSTOM_GAME_REPETITION,
  CUSTOM_GAME_STALEMATE,
} from '@libs/chess-custom-game-harness/custom-game-histories';
import { readCustomGameTime } from '@libs/game-session-harness/custom-game-clocks';
import { playCustomGameHistory } from '@libs/game-session-harness/custom-game-history';
import { customGameTimeLeft } from '@libs/game-session-shared/custom-game-state';
import { Given } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  customFact,
  customGame,
  customHumans,
  customPeople,
  customStart,
} from './custom-game-world';

async function history(
  w: HarnessWorld,
  moves: readonly string[]
): Promise<void> {
  const link = String(w.memo.get('custom-link'));
  const game = await customGame(w);
  const actor = (person: string): string => {
    const found = [...customPeople(w)].find(([, id]) => id === person)?.[0];
    if (found === undefined) throw new Error(`no device for ${person}`);
    return found;
  };
  await w.s.apply(playCustomGameHistory, {
    spaceId: link.split('/space/')[1] ?? '',
    white: actor(game.white.person),
    black: actor(game.black.person),
    moves,
  });
}
async function historicalGame(
  w: HarnessWorld,
  host: string,
  moves: readonly string[]
): Promise<void> {
  await customHumans(w, { host, white: host, black: 'bob', active: true });
  await history(w, moves);
}

Given(
  "{actor} has an active Custom Game after White's e4",
  async (w, host: string) => historicalGame(w, host, ['e2e4'])
);
Given(
  '{actor} has an active Custom Game one move before White promotes on e8',
  async (w, host: string) =>
    historicalGame(w, host, CUSTOM_GAME_BEFORE_PROMOTION)
);
Given(
  '{actor} has an active Custom Game one move before White castles kingside',
  async (w, host: string) =>
    historicalGame(w, host, CUSTOM_GAME_BEFORE_CASTLING)
);
Given(
  '{actor} has an active Custom Game one move before White captures en passant on d6',
  async (w, host: string) =>
    historicalGame(w, host, CUSTOM_GAME_BEFORE_EN_PASSANT)
);
Given(
  "{actor} has an active Custom Game where White's king would castle through check",
  async (w, host: string) =>
    historicalGame(w, host, CUSTOM_GAME_CASTLING_THROUGH_CHECK)
);
Given(
  "{actor} has a completed Custom Game after White's e4",
  async (w, host: string) => {
    await historicalGame(w, host, ['e2e4']);
    await customFact(w, host, { operation: 'resign' });
    w.memo.set('custom-completed', await customGame(w));
  }
);
Given(
  "{actor} has an active Custom Game one move before Black's checkmate",
  async (w, host: string) =>
    historicalGame(w, host, CUSTOM_GAME_FOOLS_MATE.slice(0, 3))
);
Given(
  '{actor} has a Custom Game one move before the third repetition',
  async (w, host: string) =>
    historicalGame(w, host, CUSTOM_GAME_REPETITION.slice(0, 7))
);
Given(
  '{actor} has a Custom Game one move before the second repetition',
  async (w, host: string) =>
    historicalGame(w, host, CUSTOM_GAME_REPETITION.slice(0, 3))
);
Given(
  '{actor} has a Custom Game one move before stalemate',
  async (w, host: string) =>
    historicalGame(w, host, CUSTOM_GAME_STALEMATE.slice(0, 18))
);
Given(
  '{actor} has a Custom Game one move before only the two kings remain',
  async (w, host: string) =>
    historicalGame(w, host, CUSTOM_GAME_MATERIAL.slice(0, 53))
);
Given(
  '{actor} has a Custom Game one move before fifty moves without a pawn move or capture',
  async (w, host: string) =>
    historicalGame(w, host, CUSTOM_GAME_FIFTY.slice(0, 99))
);
Given(
  '{actor} has a Custom Game two moves before fifty moves without a pawn move or capture',
  async (w, host: string) =>
    historicalGame(w, host, CUSTOM_GAME_FIFTY.slice(0, 98))
);
Given(
  "{actor} has an active Custom Game with a queen against {actor}'s bare king",
  async (w, host: string, black: string) => {
    await customHumans(w, { host, white: host, black, active: true });
    await history(w, CUSTOM_GAME_MATERIAL.slice(0, 52));
  }
);
Given(
  "{actor} hosts an active Custom Game with {actor}'s queen against {actor}'s bare king",
  async (w, host: string, white: string, black: string) => {
    await customHumans(w, { host, white, black, active: true });
    await history(w, CUSTOM_GAME_MATERIAL.slice(0, 52));
  }
);
Given(
  "{actor} has a timed Custom Game with a queen against {actor}'s bare king",
  async (w, host: string, black: string) => {
    await customHumans(w, { host, white: host, black });
    await customFact(w, host, { operation: 'clock', minutes: 1, increment: 0 });
    await customStart(w);
    await history(w, CUSTOM_GAME_MATERIAL.slice(0, 52));
  }
);
Given(
  '{word} has one second left in the Custom Game',
  async (w, side: string) => {
    if (side === 'Black') await history(w, ['h6f6']);
    const game = await customGame(w);
    await w.s.advanceTime(
      customGameTimeLeft(game, game.turn, await w.s.read(readCustomGameTime)) -
        1000
    );
  }
);
