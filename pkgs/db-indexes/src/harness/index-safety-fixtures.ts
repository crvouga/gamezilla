import type { Config } from '../core/config';
import { fingerprintSql } from '../core/fingerprint';
import { ownedIndexName } from '../core/naming';
import type { IndexInfo, OwnedMeta, WorkloadManifest } from '../core/types';
import type { HarnessDbOptions } from './db';

export const SAFETY_DAY_MS = 86_400_000;
export const SAFETY_NOW = 31 * SAFETY_DAY_MS;
export const SAFETY_CONFIG: Partial<Config> = {
  minTableRows: 1,
  createEstimatedMs: 10,
  dropEstimatedMs: 1,
  metaEstimatedMs: 1,
};

export const SAFETY_INDEX = ownedIndexName({
  table: 'notes',
  columns: [{ name: 'user_id', order: 'asc' }],
  include: ['id'],
  predicate: null,
});

export function safetyManifest(fields: readonly string[]): WorkloadManifest {
  return {
    version: 1,
    queries: fields.map((field) => {
      const sql = `SELECT id FROM notes WHERE ${field} = ?`;
      return {
        name: `notes-by-${field}`,
        hydrates: ['notes'],
        statements: [
          { index: 0, sql, fingerprint: fingerprintSql(sql), weight: 1 },
        ],
      };
    }),
  };
}

function indexInfo(overrides: Partial<IndexInfo> = {}): IndexInfo {
  return {
    name: SAFETY_INDEX,
    table: 'notes',
    columns: ['user_id'],
    include: ['id'],
    predicate: null,
    isUnique: false,
    isPrimary: false,
    isValid: true,
    isOwned: true,
    ...overrides,
  };
}

export type SafetyFault =
  | 'none'
  | 'before'
  | 'after'
  | 'invalid'
  | 'deferred'
  | 'failed';
export type SafetyFixture = {
  readonly seed: Omit<HarnessDbOptions, 'clock'>;
  readonly manifest: WorkloadManifest;
  readonly protected: readonly IndexInfo[];
  readonly config: Partial<Config>;
  readonly fault: SafetyFault;
  readonly missingUsage: boolean;
};

function retirementFixture(name: string): SafetyFixture {
  const info = indexInfo();
  const baseline = name === 'reset usage' || name === 'missing usage' ? 5 : 0;
  const meta: OwnedMeta = {
    name: SAFETY_INDEX,
    deprecatedAt: 0,
    usageAtDeprecation: baseline,
    payload: '{}',
  };
  return {
    seed: {
      tables: [{ name: 'notes', estimatedRows: 50_000 }],
      indexes: [{ info, scans: name === 'used retirement' ? 1 : 0 }],
      metas: name === 'new retirement' ? [] : [meta],
    },
    manifest: safetyManifest(name === 'desired retirement' ? ['user_id'] : []),
    protected: [],
    config: SAFETY_CONFIG,
    fault: 'none',
    missingUsage: name === 'missing usage',
  };
}

function protectedFixture(name: string): SafetyFixture {
  const indexes =
    name === 'operator indexes'
      ? [
          indexInfo({ name: 'ix_notes_author', isOwned: false }),
          indexInfo({ name: 'ux_notes_title', isOwned: false, isUnique: true }),
        ]
      : [
          indexInfo({
            name:
              name === 'desired unique name'
                ? SAFETY_INDEX
                : 'autoidx_notes_deadbeef',
            isOwned: false,
            isPrimary: name === 'primary impostor',
            isUnique: name !== 'primary impostor',
            isValid: name !== 'invalid unique',
          }),
        ];
  return {
    seed: {
      tables: [{ name: 'notes', estimatedRows: 50_000 }],
      indexes: indexes.map((info) => ({ info, scans: 0 })),
    },
    manifest: safetyManifest(name === 'desired unique name' ? ['user_id'] : []),
    protected: indexes,
    config: SAFETY_CONFIG,
    fault: 'none',
    missingUsage: false,
  };
}

const BUILD_FAULTS: Readonly<Record<string, SafetyFault>> = {
  'new build': 'none',
  'two builds': 'none',
  'crash before build': 'before',
  'crash after build': 'after',
  'crash invalid build': 'invalid',
  'lock contention': 'deferred',
  'failed build': 'failed',
};

const RETIREMENTS = new Set([
  'expired retirement',
  'new retirement',
  'used retirement',
  'reset usage',
  'missing usage',
  'desired retirement',
]);
const PROTECTED = new Set([
  'operator indexes',
  'primary impostor',
  'unique impostor',
  'invalid unique',
  'desired unique name',
]);

export function safetyFixture(name: string): SafetyFixture {
  if (RETIREMENTS.has(name)) return retirementFixture(name);
  if (PROTECTED.has(name)) return protectedFixture(name);
  const fault = BUILD_FAULTS[name];
  if (fault === undefined) throw new Error(`unknown indexing fixture: ${name}`);
  const protectedIndex = indexInfo({
    name: 'ix_notes_title',
    columns: ['title'],
    isOwned: false,
  });
  return {
    seed: {
      tables: [{ name: 'notes', estimatedRows: 50_000 }],
      indexes: [{ info: protectedIndex, scans: 0 }],
    },
    manifest: safetyManifest(
      name === 'two builds' ? ['user_id', 'owner_id'] : ['user_id']
    ),
    protected: [protectedIndex],
    config: {
      ...SAFETY_CONFIG,
      maxBuildsPerRun: name === 'two builds' ? 1 : 3,
    },
    fault,
    missingUsage: false,
  };
}
