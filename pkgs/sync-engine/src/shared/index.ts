/**
 * Public shared surface for `@pkgs/sync-engine` (runtime-agnostic).
 * Import from `@pkgs/sync-engine/shared` only — deep paths are not public.
 */

export { defineMutation } from '../mutations/core/define-mutation';
export { mutationRegistry } from '../mutations/core/registry';
export {
  type MutateResult,
  type Mutation,
  type MutationCtx,
  type MutationDb,
  type MutationEnv,
  MutationError,
  type MutationRegistry,
} from '../mutations/core/types';
export {
  LIVE_ROW_SQL,
  softDeleteById,
} from '../mutations/shared/soft-delete';
export { withFrameworkMutations } from '../mutations/shared/with-framework-mutations';

export { defineQuery } from '../queries/core/define-query';
export { queryRegistry } from '../queries/core/registry';
export type {
  AuthErrorBody,
  QueryCtx,
  QueryDef,
  QueryRegistry,
  QueryResponse,
  QueryRow,
} from '../queries/core/types';

export { applyFrameworkServerDdl } from './apply-framework-server-ddl';
export {
  assertChannelExhaustiveness,
  type ChannelGap,
  findChannelExhaustivenessGaps,
} from './channel-exhaustiveness';
export {
  FRAMEWORK_CACHE_TABLE_NAMES,
  FRAMEWORK_DURABLE_TABLE_NAMES,
  FRAMEWORK_SERVER_DDL,
  FRAMEWORK_TABLE_NAMES,
} from './framework-server-ddl';
