/**
 * Application-owned, declarative Postgres expression / partial indexes on
 * patch-db's `snapshots` table. Every spec is built from typed
 * `AttributeTag`s and `*_ENTITY_TYPE` constants from feature packages, so
 * entity-type and attribute-key drift between code and SQL cannot happen.
 *
 * Patch-db reconciles these against the live database during
 * {@link PatchDbImplPostgres.migrateUp} (creates missing, drops orphaned
 * `pdb_idx_*` indexes); see `libs/patch-db/src/indexes/`.
 */
import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountProviderAttr,
  AccountSessionAttr,
} from '@gamezilla/auth/shared/auth-entities';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/spaces/shared/space-entities';
import type { PatchDbIndexSpec } from '@gamezilla/patch-db/interface';

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
];
