import { ALL_INBOX_SYNC_TABLES } from '@pkgs/inbox/sync/table-defs';
import type { TablePolicy } from '@pkgs/sync-engine/mutations/shared/table-policy';

import { AUTH_TABLE_NAMES } from './auth-tables';
import { ALL_CHESS_SYNC_TABLES } from './chess-tables';
import { ALL_CLIENT_CONFIG_SYNC_TABLES } from './client-config-tables';
import { ALL_FRIENDS_SYNC_TABLES } from './friends-tables';
import { ALL_PROFILE_SYNC_TABLES } from './profile-tables';
import { ALL_SPACE_SYNC_TABLES } from './space-tables';

const DOMAIN_TABLES = [
  ...ALL_SPACE_SYNC_TABLES,
  ...ALL_FRIENDS_SYNC_TABLES,
  ...ALL_PROFILE_SYNC_TABLES,
  'devices',
  'chess_puzzle_profiles',
  'chess_puzzle_interactions',
] as const;

const SERVER_ONLY_TABLES = [
  'users',
  'external_accounts',
  ...ALL_CLIENT_CONFIG_SYNC_TABLES,
  ...ALL_INBOX_SYNC_TABLES,
  'chess_puzzles',
  'chess_puzzle_load',
  '_mutations_applied',
  'write_rejections',
  'inbox_schema_state',
] as const;

const FRAMEWORK_TABLES = ['_mutations'] as const;

function buildPolicyMap(): Readonly<Record<string, TablePolicy>> {
  const map: Record<string, TablePolicy> = {};
  for (const name of DOMAIN_TABLES) map[name] = 'DOMAIN';
  for (const name of SERVER_ONLY_TABLES) map[name] = 'SERVER_ONLY';
  for (const name of FRAMEWORK_TABLES) map[name] = 'FRAMEWORK';

  for (const name of AUTH_TABLE_NAMES) {
    if (map[name] === undefined) {
      throw new Error(`TABLE_POLICY missing auth table: ${name}`);
    }
  }
  for (const name of ALL_CHESS_SYNC_TABLES) {
    if (map[name] === undefined) {
      throw new Error(`TABLE_POLICY missing chess table: ${name}`);
    }
  }
  return map;
}

export const TABLE_POLICY = buildPolicyMap();

export function tablePolicyFor(table: string): TablePolicy | undefined {
  return TABLE_POLICY[table];
}

export type { TablePolicy };
