import { CHESS_GAME_ID } from '@libs/chess-root-harness-ts/chess-playable';
import { joinMultiplayerSpace } from '@libs/game-matchmaking-harness-ts/multiplayer-board';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { Given } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';

Given(
  "{actor} is a guest watching {actor}'s multiplayer game",
  async (w, watcher: Actor, host: Actor) => {
    await w.s.apply(openFindingAnOpponent, host, CHESS_GAME_ID);
    await w.s.apply(joinMultiplayerSpace, watcher, host);
    w.memo.set(`multiplayer:watcher:${watcher}`, true);
  }
);
