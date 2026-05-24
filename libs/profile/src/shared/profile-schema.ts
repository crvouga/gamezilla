/**
 * PatchDB entity schema for the profile feature.
 */
import {
  defineEntitySchema,
  type EntitySchema,
} from '@pkgs/patch-db/schema/entity-schema';
import { PROFILE_ENTITY_TYPE, ProfileAttr } from './profile-entities';

export const ProfileSchema: EntitySchema = defineEntitySchema({
  entityType: PROFILE_ENTITY_TYPE,
  attributes: ProfileAttr,
});

export const ALL_PROFILE_ENTITY_SCHEMAS: readonly EntitySchema[] = [
  ProfileSchema,
];
