import { ownedIndexName } from '@pkgs/db-indexes-root-shared-ts/naming';
import type { IndexInfo } from '@pkgs/db-indexes-root-shared-ts/types';
import type { SafetyFixture } from './index-safety-fixtures';
import {
  SAFETY_CONFIG,
  SAFETY_INDEX,
  safetyManifest,
} from './index-safety-fixtures';

function ordinaryIndex(field: string): IndexInfo {
  const definition = {
    table: 'notes',
    columns: [{ name: field, order: 'asc' as const }],
    include: ['id'],
    predicate: null,
  };
  return {
    name: ownedIndexName(definition),
    table: 'notes',
    columns: [field],
    include: ['id'],
    predicate: null,
    isUnique: false,
    isPrimary: false,
    isValid: true,
    isOwned: true,
  };
}

export function mixedSafetyFixture(): SafetyFixture {
  const author = ordinaryIndex('user_id');
  const title = ordinaryIndex('title');
  const body = ordinaryIndex('body');
  const protectedIndex = {
    ...ordinaryIndex('title'),
    name: 'ix_notes_title',
    isOwned: false,
  };
  return {
    seed: {
      tables: [{ name: 'notes', estimatedRows: 50_000 }],
      indexes: [author, title, body, protectedIndex].map((info) => ({
        info,
        scans: 0,
      })),
      metas: [SAFETY_INDEX, title.name].map((name) => ({
        name: name as typeof SAFETY_INDEX,
        deprecatedAt: 0,
        usageAtDeprecation: 0,
        payload: '{}',
      })),
    },
    manifest: safetyManifest(['user_id', 'owner_id']),
    protected: [protectedIndex],
    config: SAFETY_CONFIG,
    fault: 'none',
    missingUsage: false,
  };
}
