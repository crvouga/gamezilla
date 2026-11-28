import { expect } from 'bun:test';
import { readGameSessionName } from '@libs/game-session-harness-ts/game-session-names';
import type { GameSessionSide } from '@libs/game-session-shared-ts/game-session-state';
import { Then } from '@libs/harness-ts/define';
import { backToGameSessions, hostOf } from './game-world';

Then(
  'the {gameSide} is named {username}',
  async (w, side: GameSessionSide, username: string) => {
    await backToGameSessions(w, hostOf(w));
    expect(await w.s.read(readGameSessionName, hostOf(w), side)).toBe(username);
  }
);
