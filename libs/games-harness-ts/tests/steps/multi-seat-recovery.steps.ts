import { expect } from 'bun:test';
import { finishGameSessionAgainstBots } from '@libs/game-session-harness-ts/game-session-bots';
import { gameSessionView } from '@libs/game-session-harness-ts/game-session-probe';
import type { GameSession } from '@libs/game-session-shared-ts/game-session-state';
import { Given, Then } from '@libs/harness-ts/define';
import { cutConnection } from '@libs/harness-ts/platform';
import { chosen, current } from './game-session-set-up-world';
import { setupGameSession, turnGameOf } from './game-world';

Given('Alice, Bob, Carol and Dave have a four-player game session', async (w) =>
  setupGameSession(w, { third: 'carol', fourth: 'dave' })
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
Given('Alice has a four-player game session against three bots', async (w) =>
  setupGameSession(w, { second: 'bot', third: 'bot', fourth: 'bot' })
);
Given(
  'Alice has a finished four-player game session against three bots while offline',
  async (w) => {
    await setupGameSession(w, { second: 'bot', third: 'bot', fourth: 'bot' });
    await cutConnection(w, 'alice');
    await w.s.apply(finishGameSessionAgainstBots, 'alice');
    w.memo.set('four-seat-recovery-before', await current(w));
  }
);

Then(
  'Carol sees the same four-player game session with both moves',
  async (w) => {
    const earlier = w.memo.get('four-seat-recovery-before') as GameSession;
    const seen = await w.s.until((s) => gameSessionView(s, 'carol'), {
      pred: (view) => view.current?.moves.length === 2,
    });
    expect(seen.current?.id).toBe(earlier.id);
    expect(seen.current?.fen).toBe(earlier.fen);
    expect(seen.current?.moves).toEqual(earlier.moves);
  }
);
Then('{actor} has the game session turn', async (w, actor: string) => {
  const seen = await w.s.until((s) => gameSessionView(s, actor), {
    pred: (view) =>
      view.current?.turn === view.mySide && view.gates['move'] === true,
  });
  expect(seen.current?.turn).toBe(seen.mySide!);
  expect(seen.gates['move']).toBe(true);
});
Then('Alice sees three legal bot replies and her next turn', async (w) => {
  const seen = await w.s.until((s) => gameSessionView(s, 'alice'), {
    maxMs: 10_000,
    pred: (view) => view.current?.moves.length === 4,
  });
  const game = seen.current!;
  expect(game.turn).toBe(seen.mySide!);
  const rules = turnGameOf(w).shared.turnGame.rules;
  const actions = game.moves.map((move) => move.uci);
  // Each reply is a legal move where it was made; a game with dealt hands
  // records the public action its proposal resolved to, which its rules
  // accept there (its `legal` lists no hidden hand's cards).
  for (let ply = 1; ply < actions.length; ply++) {
    const before = rules.replay(actions, ply);
    if (rules.hands === undefined)
      expect(rules.legal(before)).toContain(actions[ply]!);
    else
      expect(
        rules.play(before, actions[ply]!, '', actions.slice(0, ply))
      ).not.toBeNull();
  }
});
Then(
  "the four-player game session's board and finished result are unchanged",
  async (w) => {
    const earlier = w.memo.get('four-seat-recovery-before') as GameSession;
    const seen = await w.s.until((s) => gameSessionView(s, 'alice'), {
      pred: (view) => view.connected && view.current?.status === 'completed',
    });
    expect(earlier.status).toBe('completed');
    expect(seen.current?.id).toBe(earlier.id);
    expect(seen.current?.fen).toBe(earlier.fen);
    expect(seen.current?.outcome).toBe(earlier.outcome);
    expect(seen.current?.moves).toEqual(earlier.moves);
  }
);
