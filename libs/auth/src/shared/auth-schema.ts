/**
 * PatchDB entity schemas for the auth feature.
 */
import {
  defineEntitySchema,
  type EntitySchema,
} from '@pkgs/patch-db/schema/entity-schema';
import {
  ACCOUNT_ENTITY_TYPE,
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountAttr,
  AccountProviderAttr,
  AccountSessionAttr,
  DEVICE_ENTITY_TYPE,
  DeviceAttr,
} from './auth-entities';

export const DeviceSchema: EntitySchema = defineEntitySchema({
  entityType: DEVICE_ENTITY_TYPE,
  attributes: DeviceAttr,
});

export const AccountSchema: EntitySchema = defineEntitySchema({
  entityType: ACCOUNT_ENTITY_TYPE,
  attributes: AccountAttr,
});

export const AccountProviderSchema: EntitySchema = defineEntitySchema({
  entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
  attributes: AccountProviderAttr,
});

export const AccountSessionSchema: EntitySchema = defineEntitySchema({
  entityType: ACCOUNT_SESSION_ENTITY_TYPE,
  attributes: AccountSessionAttr,
});

export const ALL_AUTH_ENTITY_SCHEMAS: readonly EntitySchema[] = [
  DeviceSchema,
  AccountSchema,
  AccountProviderSchema,
  AccountSessionSchema,
];
