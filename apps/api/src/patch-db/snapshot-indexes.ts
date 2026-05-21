/**
 * Application-owned, declarative Postgres expression / partial indexes on
 * patch-db's `snapshots` table. Every spec is built from typed
 * `AttributeTag`s and `*_ENTITY_TYPE` constants from feature packages, so
 * entity-type and attribute-key drift between code and SQL cannot happen.
 *
 * Patch-db reconciles these against the live database during
 * {@link PatchDbImplPostgres.migrateUp} (creates missing, drops orphaned
 * `pdb_idx_*` indexes); see `pkgs/patch-db/src/indexes/`.
 */
import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountProviderAttr,
  AccountSessionAttr,
} from '@libs/auth/shared/auth-entities';
import {
  CHESS_PUZZLE_ENTITY_TYPE,
  ChessPuzzleAttr,
} from '@libs/chess/shared/chess-puzzle-entities';
import type { PatchDbIndexSpec } from '@pkgs/patch-db/interface';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@libs/spaces/shared/space-entities';

export const APP_SNAPSHOT_INDEXES: readonly PatchDbIndexSpec[] = [
  {
    name: 'space-host',
    entityType: SPACE_ENTITY_TYPE,
    fields: [{ kind: 'attribute', attribute: SpaceAttr.hostId }],
  },
  {
    name: 'space-live',
    entityType: SPACE_ENTITY_TYPE,
    fields: [{ kind: 'entityType' }, { kind: 'entityId' }],
    where: [{ kind: 'attributeAbsent', attribute: SpaceAttr.endedAt }],
  },
  {
    name: 'membership-guest',
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    fields: [{ kind: 'attribute', attribute: SpaceMembershipAttr.guestId }],
  },
  {
    name: 'membership-space',
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    fields: [{ kind: 'attribute', attribute: SpaceMembershipAttr.spaceId }],
  },
  {
    name: 'membership-active',
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    fields: [{ kind: 'entityType' }, { kind: 'entityId' }],
    where: [{ kind: 'attributeAbsent', attribute: SpaceMembershipAttr.leftAt }],
  },
  {
    name: 'session-device',
    entityType: ACCOUNT_SESSION_ENTITY_TYPE,
    fields: [{ kind: 'attribute', attribute: AccountSessionAttr.deviceId }],
  },
  {
    name: 'session-account',
    entityType: ACCOUNT_SESSION_ENTITY_TYPE,
    fields: [{ kind: 'attribute', attribute: AccountSessionAttr.accountId }],
  },
  {
    name: 'provider-account',
    entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
    fields: [{ kind: 'attribute', attribute: AccountProviderAttr.accountId }],
  },
  // `chess.puzzle` is static reference data with ~5M rows. Without these
  // indexes every picker / player query falls back to a full partition scan.
  {
    // Covers the picker's `ORDER BY chess.puzzle/popularity DESC LIMIT N` so
    // the planner can walk the index backwards instead of sorting 5M rows.
    name: 'puzzle-popularity',
    entityType: CHESS_PUZZLE_ENTITY_TYPE,
    fields: [{ kind: 'attribute', attribute: ChessPuzzleAttr.popularity }],
  },
  {
    // Covers the player's `WHERE chess.puzzle/id = ? LIMIT 1` lookup. Note
    // `chess.puzzle/id` is the same value as the snapshot row's `entity_id`,
    // but the query goes through the attribute path so we index the
    // expression form explicitly.
    name: 'puzzle-id',
    entityType: CHESS_PUZZLE_ENTITY_TYPE,
    fields: [{ kind: 'attribute', attribute: ChessPuzzleAttr.id }],
  },
];
