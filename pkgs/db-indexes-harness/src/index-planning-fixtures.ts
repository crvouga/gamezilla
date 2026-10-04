import { MIGRATE_RECONCILE_CONFIG } from '@pkgs/db-indexes-shared/config';
import type { WorkloadManifest } from '@pkgs/db-indexes-shared/types';
import type { SafetyFixture } from './index-safety-fixtures';
import { SAFETY_CONFIG, safetyManifest } from './index-safety-fixtures';

const ROWS: Readonly<Record<string, number>> = {
  'below row threshold': 9999,
  'at row threshold': 10_000,
  'above row threshold': 10_001,
};
const IMPROVEMENTS: Readonly<Record<string, number>> = {
  'below improvement': 2.99,
  'at improvement': 3,
  'above improvement': 3.01,
};
const MANIFESTS: Readonly<Record<string, WorkloadManifest>> = {
  'duplicate lookup': safetyManifest(['user_id', 'user_id']),
  'per table cap': safetyManifest(['user_id', 'owner_id']),
  'primary lookup': safetyManifest(['id']),
  'empty workload': safetyManifest([]),
};

export function planningFixture(name: string): SafetyFixture | undefined {
  const rows = ROWS[name];
  const improvement = IMPROVEMENTS[name];
  const manifest = MANIFESTS[name];
  if (
    rows === undefined &&
    improvement === undefined &&
    manifest === undefined &&
    name !== 'migration on empty table'
  )
    return undefined;
  return {
    seed: {
      tables: [
        {
          name: 'notes',
          estimatedRows:
            name === 'migration on empty table' ? 0 : (rows ?? 50_000),
        },
      ],
      defaultImprovement: improvement ?? 10,
    },
    manifest: manifest ?? safetyManifest(['user_id']),
    protected: [],
    fault: 'none',
    missingUsage: false,
    config: {
      ...SAFETY_CONFIG,
      minTableRows: 10_000,
      ...(name === 'per table cap' ? { maxIndexesPerTable: 1 } : {}),
      ...(name === 'migration on empty table' ? MIGRATE_RECONCILE_CONFIG : {}),
    },
  };
}
