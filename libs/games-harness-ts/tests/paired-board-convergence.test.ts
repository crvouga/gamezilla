import { expect, test } from 'bun:test';
import { matchStep } from '@pkgs/gherkin-shared-ts/registry';
import './steps/finding-an-opponent.steps';

const formed = {
  id: 'a8327294-e026-4f58-b0c9-92e1be6f7890',
  white_id: 'alice',
  black_id: 'bob',
  revision: 0,
  time_control: 'battleship/3+0',
  clock_at_ms: 1795726371898,
  setup_ready: '',
};
const ready = {
  ...formed,
  setup_ready: 'white,black',
  clock_at_ms: 1795726372281,
};
type View = { game: typeof formed; board: boolean };
const visible = (game: typeof formed): View => ({ game, board: true });

/** Replay consecutive device snapshots against the game the server committed. */
async function receiveGame(alice: readonly View[], bob: readonly View[]) {
  const step = matchStep(
    'Alice and Bob receive the same new game on opposite sides'
  );
  if (step.kind !== 'match') throw new Error('Missing pairing step');
  let snapshots: readonly View[] = [];
  await step.definition.body(
    {
      ctx: { variant: { id: 'battleship' } },
      s: {
        read: async () => ready,
        apply: async (_open: unknown, actor: string) => {
          snapshots = actor === 'alice' ? alice : bob;
        },
        until: async (
          _observe: unknown,
          opts: { pred: (view: View) => boolean }
        ) => {
          const found = snapshots.find(opts.pred);
          if (!found) throw new Error('Device never showed the expected game');
          return found;
        },
      },
    },
    ...step.args
  );
}

// regression: paired-battleship-setup-clock-convergence
test('Alice receives both ready sides and the new clock after first seeing the initial board', async () => {
  await expect(
    receiveGame([visible(formed), visible(ready)], [visible(ready)])
  ).resolves.toBeUndefined();
});

test.each([
  ['both boards are stale', visible(formed)],
  [
    'the clock alone is stale',
    visible({ ...ready, clock_at_ms: formed.clock_at_ms }),
  ],
  ['the board is hidden', { game: ready, board: false }],
] as const)('pairing remains unconfirmed when %s', async (_reason, view) => {
  await expect(receiveGame([view], [view])).rejects.toThrow(
    'Device never showed the expected game'
  );
});

test('Bob must receive the accepted setup even after Alice has caught up', async () => {
  await expect(
    receiveGame([visible(ready)], [visible(formed)])
  ).rejects.toThrow('Device never showed the expected game');
});
