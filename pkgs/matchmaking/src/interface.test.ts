/**
 * Default hermetic suite: contract tests against the in-memory adapter.
 */

import { describe } from 'bun:test';
import { MatchmakingImplInMemory } from './impl-in-memory';
import {
  type BootOverrides,
  resolveConfig,
  runMatchmakingAppContractTests,
  runMatchmakingContractTests,
} from './testing';

async function inMemoryFactory(overrides?: BootOverrides) {
  const mm = new MatchmakingImplInMemory(resolveConfig(overrides));
  await mm.ready();
  return mm;
}

describe('MatchmakingImplInMemory contract', () => {
  runMatchmakingContractTests(inMemoryFactory);
});

describe('MatchmakingImplInMemory app contract', () => {
  runMatchmakingAppContractTests(inMemoryFactory);
});
