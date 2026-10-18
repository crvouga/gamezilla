import { CHESS_GAME_ID } from '@libs/chess-root-harness/chess-playable';
import { joinMultiplayerSpace } from '@libs/game-matchmaking-harness/multiplayer-board';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { Given } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';

Given(
  "{actor} is a guest watching {actor}'s multiplayer game",
  async (w, watcher: Actor, host: Actor) => {
    await w.s.apply(openFindingAnOpponent, host, CHESS_GAME_ID);
    await w.s.apply(joinMultiplayerSpace, watcher, host);
    w.memo.set(`multiplayer:watcher:${watcher}`, true);
  }
);
