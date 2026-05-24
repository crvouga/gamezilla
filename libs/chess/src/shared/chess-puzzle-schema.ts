/**
 * PatchDB entity schemas for the chess feature.
 *
 * One {@link EntitySchema} per entity type owned by this package. These are
 * pure constants — no global registration side-effects. The app composes
 * them into a frozen {@link FrozenEntitySchemaRegistry} in
 * `apps/api/src/patch-db/schema-registry.ts`.
 *
 * Every attribute marked `.indexed()` on its tag becomes a typed generated
 * column + native btree on the entity type's snapshot partition (Phase 2);
 * for now (Phase 1) the legacy expression-index reconciler picks them up
 * via {@link entitySchemaToIndexSpecs}.
 */
import { AbacEntityAttr } from '@pkgs/patch-db/abac/abac-entity-attr';
import {
  defineEntitySchema,
  type EntitySchema,
} from '@pkgs/patch-db/schema/entity-schema';
import {
  CHESS_PUZZLE_ENTITY_TYPE,
  CHESS_PUZZLE_LOAD_ENTITY_TYPE,
  ChessPuzzleAttr,
  ChessPuzzleLoadAttr,
} from './chess-puzzle-entities';
import {
  CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
  ChessPuzzleInteractionAttr,
} from './chess-puzzle-interaction-entities';
import {
  CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
  ChessPuzzleProfileAttr,
} from './chess-puzzle-profile-entities';

/** Static Lichess puzzle reference data (~5M rows in production). */
export const ChessPuzzleSchema: EntitySchema = defineEntitySchema({
  entityType: CHESS_PUZZLE_ENTITY_TYPE,
  attributes: ChessPuzzleAttr,
  composite: [
    {
      // Picker walks `WHERE rating BETWEEN ? AND ? ORDER BY popularity DESC LIMIT N` —
      // a covering composite is dramatically faster than two single-column scans.
      name: 'rating-popularity',
      fields: [
        { tag: ChessPuzzleAttr.rating, direction: 'asc' },
        { tag: ChessPuzzleAttr.popularity, direction: 'desc' },
      ],
    },
  ],
});

/** Singleton CSV loader progress row (`entityId = 'dataset'`). */
export const ChessPuzzleLoadSchema: EntitySchema = defineEntitySchema({
  entityType: CHESS_PUZZLE_LOAD_ENTITY_TYPE,
  attributes: ChessPuzzleLoadAttr,
});

/** Per-user denormalized puzzle rating cache (one row per user). */
export const ChessPuzzleProfileSchema: EntitySchema = defineEntitySchema({
  entityType: CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
  attributes: {
    ...ChessPuzzleProfileAttr,
    /** ABAC `entity/owner` so profile rows are visibility-scoped per owner. */
    owner: AbacEntityAttr.owner,
  },
});

/** Append-only puzzle interaction log. */
export const ChessPuzzleInteractionSchema: EntitySchema = defineEntitySchema({
  entityType: CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
  attributes: {
    ...ChessPuzzleInteractionAttr,
    owner: AbacEntityAttr.owner,
  },
  composite: [
    {
      // Rating recompute walks an owner's history newest-first.
      name: 'owner-at',
      fields: [
        { tag: ChessPuzzleInteractionAttr.ownerId, direction: 'asc' },
        { tag: ChessPuzzleInteractionAttr.at, direction: 'desc' },
      ],
    },
  ],
});

/** All chess schemas — convenience export for the app's registry composition. */
export const ALL_CHESS_ENTITY_SCHEMAS: readonly EntitySchema[] = [
  ChessPuzzleSchema,
  ChessPuzzleLoadSchema,
  ChessPuzzleProfileSchema,
  ChessPuzzleInteractionSchema,
];
