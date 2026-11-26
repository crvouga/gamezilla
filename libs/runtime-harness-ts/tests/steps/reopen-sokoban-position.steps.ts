import { actorLocalSql } from '@libs/harness-ts/identity';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import type { JourneyWorld } from '@libs/runtime-harness-ts/journey-types';
import { registerSokobanRecovery } from '@libs/runtime-harness-ts/sokoban-recovery.steps';

registerSokobanRecovery<HarnessWorld & JourneyWorld>((w) =>
  w.s.read((s) => {
    const db = actorLocalSql(s, 'alice');
    if (!db) throw new Error('Alice has no local database');
    return db;
  })
);
