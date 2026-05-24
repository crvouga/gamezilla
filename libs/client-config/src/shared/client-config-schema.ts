/**
 * PatchDB entity schema for the client-config singleton.
 */
import {
  defineEntitySchema,
  type EntitySchema,
} from '@pkgs/patch-db/schema/entity-schema';
import {
  CLIENT_CONFIG_ENTITY_TYPE,
  ClientConfigAttr,
} from './client-config-entities';

export const ClientConfigSchema: EntitySchema = defineEntitySchema({
  entityType: CLIENT_CONFIG_ENTITY_TYPE,
  attributes: ClientConfigAttr,
});

export const ALL_CLIENT_CONFIG_ENTITY_SCHEMAS: readonly EntitySchema[] = [
  ClientConfigSchema,
];
