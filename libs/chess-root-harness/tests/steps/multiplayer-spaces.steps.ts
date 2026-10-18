import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { joinMultiplayerSpace } from '@libs/game-matchmaking-harness/multiplayer-board';
import { Given } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';

Given(
  "{actor} is a guest watching {actor}'s multiplayer game",
  async (w, watcher: Actor, host: Actor) => {
    await w.s.apply(openMultiplayerChess, host);
    await w.s.apply(joinMultiplayerSpace, watcher, host);
    w.memo.set(`multiplayer:watcher:${watcher}`, true);
  }
);
