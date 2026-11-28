import {
  GAME_SESSION_BEFORE_CASTLING,
  GAME_SESSION_BEFORE_EN_PASSANT,
  GAME_SESSION_BEFORE_PROMOTION,
  GAME_SESSION_CASTLING_THROUGH_CHECK,
  GAME_SESSION_FIFTY,
  GAME_SESSION_FOOLS_MATE,
  GAME_SESSION_MATERIAL,
  GAME_SESSION_REPETITION,
  GAME_SESSION_STALEMATE,
} from '@libs/chess-root-harness-ts/game-session-histories';
import { playGameSessionHistory } from '@libs/game-session-harness-ts/game-session-history';
import { gameSessionTimeLeftMs } from '@libs/game-session-harness-ts/game-session-screen';
import { Given } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  customFact,
  customHost,
  customHumans,
  customPeople,
  customStart,
  gameSession,
} from './game-session-world';

async function history(
  w: HarnessWorld,
  moves: readonly string[]
): Promise<void> {
  const link = String(w.memo.get('custom-link'));
  const game = await gameSession(w);
  const actor = (person: string): string => {
    const found = [...customPeople(w)].find(([, id]) => id === person)?.[0];
    if (found === undefined) throw new Error(`no device for ${person}`);
    return found;
  };
  await w.s.apply(playGameSessionHistory, {
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
  '{actor} has an active game session one move before White promotes on e8',
  async (w, host: string) =>
    historicalGame(w, host, GAME_SESSION_BEFORE_PROMOTION)
);
Given(
  '{actor} has an active game session one move before White castles kingside',
  async (w, host: string) =>
    historicalGame(w, host, GAME_SESSION_BEFORE_CASTLING)
);
Given(
  '{actor} has an active game session one move before White captures en passant on d6',
  async (w, host: string) =>
    historicalGame(w, host, GAME_SESSION_BEFORE_EN_PASSANT)
);
Given(
  "{actor} has an active game session where White's king would castle through check",
  async (w, host: string) =>
    historicalGame(w, host, GAME_SESSION_CASTLING_THROUGH_CHECK)
);
Given(
  "{actor} has an active game session one move before Black's checkmate",
  async (w, host: string) =>
    historicalGame(w, host, GAME_SESSION_FOOLS_MATE.slice(0, 3))
);
Given(
  '{actor} has a game session one move before the third repetition',
  async (w, host: string) =>
    historicalGame(w, host, GAME_SESSION_REPETITION.slice(0, 7))
);
Given(
  '{actor} has a game session one move before the second repetition',
  async (w, host: string) =>
    historicalGame(w, host, GAME_SESSION_REPETITION.slice(0, 3))
);
Given(
  '{actor} has a game session one move before stalemate',
  async (w, host: string) =>
    historicalGame(w, host, GAME_SESSION_STALEMATE.slice(0, 18))
);
Given(
  '{actor} has a game session one move before only the two kings remain',
  async (w, host: string) =>
    historicalGame(w, host, GAME_SESSION_MATERIAL.slice(0, 53))
);
Given(
  '{actor} has a game session one move before fifty moves without a pawn move or capture',
  async (w, host: string) =>
    historicalGame(w, host, GAME_SESSION_FIFTY.slice(0, 99))
);
Given(
  '{actor} has a game session two moves before fifty moves without a pawn move or capture',
  async (w, host: string) =>
    historicalGame(w, host, GAME_SESSION_FIFTY.slice(0, 98))
);
Given(
  "{actor} has a timed game session with a queen against {actor}'s bare king",
  async (w, host: string, black: string) => {
    await customHumans(w, { host, white: host, black });
    await customFact(w, host, { operation: 'clock', minutes: 1, increment: 0 });
    await customStart(w);
    await history(w, GAME_SESSION_MATERIAL.slice(0, 52));
  }
);
Given(
  '{word} has one second left in the game session',
  async (w, side: string) => {
    if (side === 'Black') await history(w, ['h6f6']);
    await gameSession(w);
    await w.s.advanceTime(
      (await w.s.read(gameSessionTimeLeftMs, customHost(w))) - 1000
    );
  }
);
