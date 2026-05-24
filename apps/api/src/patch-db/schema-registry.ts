/**
 * Single composition root for every {@link EntitySchema} this deployment
 * supports. Used by:
 *
 * - The runtime API ({@link createRequestPatchDb}) so reads / writes know
 *   what entity types exist and which attributes are indexed.
 * - The deploy-time schema reconciler (`apps/api/scripts/reconcile-schema.ts`)
 *   so partition tables, generated columns, and `pdb_idx_*` btrees match
 *   the declarations after every deploy.
 * - The legacy-flat migration script
 *   (`apps/api/scripts/migrate-db.ts`) to verify no existing snapshot rows
 *   reference an entity type that's not registered (would be silently dropped
 *   by strict-partitioning otherwise).
 *
 * Adding a new entity type:
 * 1. Declare its `defineEntitySchema(...)` in the owning feature package
 *    (e.g. `libs/chess/src/shared/chess-puzzle-schema.ts`).
 * 2. Import + register it below. The next deploy will provision the
 *    partition + indexes automatically.
 */
import { ALL_AUTH_ENTITY_SCHEMAS } from '@libs/auth/shared/auth-schema';
import { ALL_CHESS_ENTITY_SCHEMAS } from '@libs/chess/shared/chess-puzzle-schema';
import { ALL_CLIENT_CONFIG_ENTITY_SCHEMAS } from '@libs/client-config/shared/client-config-schema';
import { ALL_PROFILE_ENTITY_SCHEMAS } from '@libs/profile/shared/profile-schema';
import { ALL_SPACE_ENTITY_SCHEMAS } from '@libs/spaces/shared/space-schema';
import { ALL_STRIPE_ENTITY_SCHEMAS } from '@libs/stripe/stripe-schema';
import {
  createEntitySchemaRegistry,
  type FrozenEntitySchemaRegistry,
} from '@pkgs/patch-db/schema/entity-schema-registry';
import { ABAC_ONLY_ENTITY_SCHEMAS } from './abac-patch-schemas';

/**
 * Build the frozen registry of every PatchDB entity type this API ships
 * with. Idempotent — every call returns a fresh frozen registry over the
 * same underlying schemas.
 */
export function buildAppPatchDbSchemaRegistry(): FrozenEntitySchemaRegistry {
  return createEntitySchemaRegistry()
    .registerAll(ALL_CHESS_ENTITY_SCHEMAS)
    .registerAll(ALL_SPACE_ENTITY_SCHEMAS)
    .registerAll(ALL_AUTH_ENTITY_SCHEMAS)
    .registerAll(ALL_PROFILE_ENTITY_SCHEMAS)
    .registerAll(ALL_CLIENT_CONFIG_ENTITY_SCHEMAS)
    .registerAll(ALL_STRIPE_ENTITY_SCHEMAS)
    .registerAll(ABAC_ONLY_ENTITY_SCHEMAS)
    .freeze();
}
