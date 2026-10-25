import { expect } from 'bun:test';
import { finishCustomGameAgainstBots } from '@libs/game-session-harness-ts/custom-game-bots';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import { Given, Then } from '@libs/harness-ts/define';
import { cutConnection } from '@libs/harness-ts/platform';
import { chosen, current } from './custom-game-set-up-world';
import { setupCustomGame, turnGameOf } from './game-world';

Given('Alice, Bob, Carol and Dave have a four-player custom game', async (w) =>
  setupCustomGame(w, { third: 'carol', fourth: 'dave' })
);
Given(
  "Carol's phone was offline while Alice and Bob made their first moves",
  async (w) => {
    await cutConnection(w, 'carol');
    const line = turnGameOf(w).fixtures.firstSideVictory;
    await chosen(w, 'alice', { operation: 'move', uci: line[0]!, ply: 0 });
    await chosen(w, 'bob', { operation: 'move', uci: line[1]!, ply: 1 });
    w.memo.set('four-seat-recovery-before', await current(w));
  }
);
Given('Alice has a four-player custom game against three bots', async (w) =>
  setupCustomGame(w, { second: 'bot', third: 'bot', fourth: 'bot' })
);
Given(
  'Alice has a finished four-player custom game against three bots while offline',
  async (w) => {
    await setupCustomGame(w, { second: 'bot', third: 'bot', fourth: 'bot' });
    await cutConnection(w, 'alice');
    await w.s.apply(finishCustomGameAgainstBots, 'alice');
    w.memo.set('four-seat-recovery-before', await current(w));
  }
);

Then(
  'Carol sees the same four-player custom game with both moves',
  async (w) => {
    const earlier = w.memo.get('four-seat-recovery-before') as CustomGame;
    const seen = await w.s.until((s) => customGameView(s, 'carol'), {
      pred: (view) => view.current?.moves.length === 2,
    });
    expect(seen.current?.id).toBe(earlier.id);
    expect(seen.current?.fen).toBe(earlier.fen);
    expect(seen.current?.moves).toEqual(earlier.moves);
  }
);
Then('Carol has the custom game turn', async (w) => {
  const seen = await w.s.read(customGameView, 'carol');
  expect(seen.current?.turn).toBe(seen.mySide!);
  expect(seen.gates['move']).toBe(true);
});
Then('Alice sees three legal bot replies and her next turn', async (w) => {
  const seen = await w.s.until((s) => customGameView(s, 'alice'), {
    maxMs: 10_000,
    pred: (view) => view.current?.moves.length === 4,
  });
  const game = seen.current!;
  expect(game.turn).toBe(seen.mySide!);
  const rules = turnGameOf(w).shared.turnGame.rules;
  const actions = game.moves.map((move) => move.uci);
  // Each reply is one the rules accept where it was made (a game with dealt
  // hands records the public action its proposal resolved to).
  for (let ply = 1; ply < actions.length; ply++)
    expect(
      rules.play(
        rules.replay(actions, ply),
        actions[ply]!,
        '',
        actions.slice(0, ply)
      )
    ).not.toBeNull();
});
Then(
  "the four-player custom game's board and finished result are unchanged",
  async (w) => {
    const earlier = w.memo.get('four-seat-recovery-before') as CustomGame;
    const seen = await w.s.until((s) => customGameView(s, 'alice'), {
      pred: (view) => view.connected && view.current?.status === 'completed',
    });
    expect(earlier.status).toBe('completed');
    expect(seen.current?.id).toBe(earlier.id);
    expect(seen.current?.fen).toBe(earlier.fen);
    expect(seen.current?.outcome).toBe(earlier.outcome);
    expect(seen.current?.moves).toEqual(earlier.moves);
  }
);
