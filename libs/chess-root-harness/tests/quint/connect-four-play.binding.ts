import {
  connectFourView,
  dropConnectFour,
  establishConnectFour,
} from '@libs/connect-four-harness/connect-four-actions';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

bindQuintModel<QuintHarnessWorld>({
  model: 'connect-four-play',
  inductiveInvariant: '_inductive',
  separateInduction: true,
  inductionCaseGroupSize: 1,
  invariantMode: 'before',
  inferPolymorphicTypes: false,
  encoding: 'fun-arrays',
  traces: 16,
  maxSteps: 42,
  timeoutMs: 180_000,
  actions: {
    init: (w) => w.s.apply(establishConnectFour, {}),
    loseConnection: async (w) => {
      await w.s.apply(partition, 'alice');
      await w.s.apply(partition, 'bob');
    },
    connectionReturns: async (w) => {
      await w.s.apply(restoreActorConnection, 'alice');
      await w.s.apply(restoreActorConnection, 'bob');
    },
    drop: async (w, picks) => {
      const view = await w.s.read(connectFourView);
      await w.s.apply(
        dropConnectFour,
        view.current?.turn === 'white' ? 'alice' : 'bob',
        Number(picks['column'])
      );
    },
  },
  observe: async (w) => {
    const view = await w.s.read(connectFourView);
    return {
      ...Object.fromEntries(view.board.map((disc, i) => [`_p${i}`, disc])),
      ...Object.fromEntries(
        Array.from({ length: 7 }, (_, col) => [
          `_h${col}`,
          view.board.filter((disc, i) => i % 7 === col && disc !== 0).length,
        ])
      ),
      turn: view.current?.turn === 'white' ? 1 : 2,
      result: view.game.result,
      online: view.connected,
      drops: view.game.moves.reduce(
        (history, column) => history * 8n + BigInt(column + 1),
        0n
      ),
      _count: view.game.moves.length,
      _pairs: Math.floor(view.game.moves.length / 2),
    };
  },
});
