// goal:works-offline:4 goal:always-true:2 goal:always-true:3
/**
 * Model-based property: `quint/note-replication.qnt` draws traces (seed
 * `FC_SEED`), and each replays against `exampleSystem`, which must reach the
 * model's notes and refusal notices after every step — through lost
 * confirmations, crashes, a lossy live channel and silent operator edits.
 */

import { join } from 'node:path';
import { runQuintModel } from '@pkgs/quint/bun-test';
import './quint/note-replication.binding';
import { useNoteWorld } from './quint/note-world';

useNoteWorld();

runQuintModel({
  packageName: '@pkgs/sync-engine',
  specPath: join(import.meta.dir, 'quint/note-replication.qnt'),
  specUri: 'pkgs/sync-engine/tests/quint/note-replication.qnt',
  reportDir: join(import.meta.dir, '../.cache/sim-report'),
});
