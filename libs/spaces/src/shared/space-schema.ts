/**
 * PatchDB entity schemas for the spaces feature.
 *
 * See `libs/chess/src/shared/chess-puzzle-schema.ts` for the pattern: pure
 * `defineEntitySchema` constants, composed in `apps/api`'s registry.
 */
import {
  defineEntitySchema,
  type EntitySchema,
} from '@pkgs/patch-db/schema/entity-schema';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from './space-entities';

/** User-hosted space (room). */
export const SpaceSchema: EntitySchema = defineEntitySchema({
  entityType: SPACE_ENTITY_TYPE,
  attributes: SpaceAttr,
});

/** Guest membership (one row per guest×space). */
export const SpaceMembershipSchema: EntitySchema = defineEntitySchema({
  entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
  attributes: SpaceMembershipAttr,
});

export const ALL_SPACE_ENTITY_SCHEMAS: readonly EntitySchema[] = [
  SpaceSchema,
  SpaceMembershipSchema,
];
