import { expect, test } from 'bun:test';
import { replayTrace } from '@pkgs/quint-shared-ts/replay';

// regression: quint-convergence-resampled
test('conformance evaluates the observation that established convergence', async () => {
  let reads = 0;
  await replayTrace({
    ctx: {
      packageName: '@pkgs/quint',
      specUri: 'door.qnt',
      model: 'door',
      trace: 1,
      seed: '0x2a',
      testId: 'door.convergence',
      title: 'Door convergence',
    },
    trace: {
      vars: ['state'],
      states: [{ action: 'init', picks: {}, vars: { state: 'open' } }],
    },
    world: {
      create: async () => ({}),
      dispose: async () => {},
      settle: async (_world, matches) => {
        await matches();
      },
    },
    binding: {
      model: 'door',
      actions: { init: async () => {} },
      observe: async () => ({ state: ++reads === 2 ? 'open' : 'closed' }),
    },
  });
  expect(reads).toBe(2);
});
