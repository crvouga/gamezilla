import { expect } from 'bun:test';
import { readCustomGameName } from '@libs/game-session-harness-ts/custom-game-names';
import type { CustomGameSide } from '@libs/game-session-shared-ts/custom-game-state';
import { Then } from '@libs/harness-ts/define';
import { backToCustomGames, hostOf } from './game-world';

Then(
  'the {gameSide} is named {username}',
  async (w, side: CustomGameSide, username: string) => {
    await backToCustomGames(w, hostOf(w));
    expect(await w.s.read(readCustomGameName, hostOf(w), side)).toBe(username);
  }
);
