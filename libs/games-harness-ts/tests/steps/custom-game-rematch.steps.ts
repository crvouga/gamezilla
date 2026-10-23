import { expect } from 'bun:test';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import { recordedLine } from '@libs/game-session-harness-ts/played-rules';
import type { CustomGameSide } from '@libs/game-session-shared-ts/custom-game-state';
import { Given, Then } from '@libs/harness-ts/define';
import {
  chosen,
  current,
  identityOf,
  settingUp,
} from './custom-game-set-up-world';
import {
  before,
  gameOf,
  hostOf,
  rememberCustomGame,
  setupCustomGame,
  sideOf,
} from './game-world';

Given(
  '{actor} has resigned a custom game after her first move',
  async (w, actor: string) => {
    await setupCustomGame(w, {
      host: actor,
      first: actor,
      moves: gameOf(w).fixtures.firstSideVictory.slice(0, 1),
    });
    await chosen(w, actor, { operation: 'resign' });
    await rememberCustomGame(w);
    w.memo.set(
      'custom-game-resigned',
      `${(await sideOf(w, actor)) === 'white' ? 'black' : 'white'} wins by resignation`
    );
  }
);
Given(
  '{actor} has a cancelled custom game that invited {actor} to the {gameSide}',
  async (w, host: string, person: string, side: CustomGameSide) => {
    await setupCustomGame(w, settingUp(host));
    await chosen(w, host, {
      operation: 'invite',
      side,
      person: await identityOf(w, person),
    });
    await chosen(w, host, { operation: 'cancel' });
    await rememberCustomGame(w);
  }
);

Then(
  'the earlier custom game still shows her move and its resignation',
  async (w) => {
    const earlier = before(w).current;
    await current(w);
    const history = (await w.s.read(customGameView, hostOf(w))).history;
    const game = history.find((candidate) => candidate.id === earlier?.id);
    expect(game?.moves.map((move) => move.uci)).toEqual(
      recordedLine(gameOf(w), gameOf(w).fixtures.firstSideVictory.slice(0, 1))
    );
    expect(game?.outcome).toBe(String(w.memo.get('custom-game-resigned')));
  }
);
Then('the new custom game has no moves', async (w) => {
  const game = await current(w);
  expect(game.id).not.toBe(before(w).current?.id);
  expect(game.moves).toEqual([]);
});
