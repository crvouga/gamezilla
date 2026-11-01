import './quint/index';
import { test } from 'bun:test';
import { decodeItfTrace } from '@pkgs/quint-shared-ts/itf';
import { quintBinding, quintWorld } from '@pkgs/quint-shared-ts/registry';
import { replayTrace } from '@pkgs/quint-shared-ts/replay';
import coldTrace from './quint/fixtures/starter-pack-cold-reconnect.itf.json';
import trace from './quint/fixtures/starter-pack-reconnect.itf.json';

// regression: bundled-pack-blocked-by-background-fetch
test.each([
  [10, trace],
  [11, coldTrace],
] as const)(
  'a bundled starter pack remains available after reconnecting (trace %s)',
  async (number, input) => {
    const binding = quintBinding('starter-pack');
    await replayTrace({
      ctx: {
        packageName: '@libs/sokoban-harness-ts',
        specUri: 'specs/sokoban/starter-pack.qnt',
        model: binding.model,
        trace: number,
        seed: '0x67932',
        testId: `starter-pack.trace-${number}`,
        title: 'A bundled starter pack remains available after reconnecting',
      },
      trace: decodeItfTrace(input),
      world: quintWorld(),
      binding,
    });
  }
);
