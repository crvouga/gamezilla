import { expect } from 'bun:test';
import { gameSessionView } from '@libs/game-session-harness-ts/game-session-probe';
import { recordedLine } from '@libs/game-session-harness-ts/played-rules';
import type { GameSessionSide } from '@libs/game-session-shared-ts/game-session-state';
import { Given, Then } from '@libs/harness-ts/define';
import {
  chosen,
  current,
  identityOf,
  settingUp,
} from './game-session-set-up-world';
import {
  before,
  hostOf,
  rememberGameSession,
  setupGameSession,
  sideOf,
  turnGameOf,
} from './game-world';

Given(
  '{actor} has resigned a game session after her first move',
  async (w, actor: string) => {
    await setupGameSession(w, {
      host: actor,
      first: actor,
      moves: turnGameOf(w).fixtures.firstSideVictory.slice(0, 1),
    });
    await chosen(w, actor, { operation: 'resign' });
    await rememberGameSession(w);
    w.memo.set(
      'game-session-resigned',
      `${(await sideOf(w, actor)) === 'white' ? 'black' : 'white'} wins by resignation`
    );
  }
);
Given(
  '{actor} has a cancelled game session that invited {actor} to the {gameSide}',
  async (w, host: string, person: string, side: GameSessionSide) => {
    await setupGameSession(w, settingUp(host));
    await chosen(w, host, {
      operation: 'invite',
      side,
      person: await identityOf(w, person),
    });
    await chosen(w, host, { operation: 'cancel' });
    await rememberGameSession(w);
  }
);

Then(
  'the earlier game session still shows her move and its resignation',
  async (w) => {
    const earlier = before(w).current;
    await current(w);
    const history = (await w.s.read(gameSessionView, hostOf(w))).history;
    const game = history.find((candidate) => candidate.id === earlier?.id);
    expect(game?.moves.map((move) => move.uci)).toEqual(
      recordedLine(
        turnGameOf(w),
        turnGameOf(w).fixtures.firstSideVictory.slice(0, 1)
      )
    );
    expect(game?.outcome).toBe(String(w.memo.get('game-session-resigned')));
  }
);
Then('the new game session has no moves', async (w) => {
  const game = await current(w);
  expect(game.id).not.toBe(before(w).current?.id);
  expect(game.moves).toEqual([]);
});
