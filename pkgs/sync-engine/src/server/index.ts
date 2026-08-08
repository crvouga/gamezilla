/**
 * Public server surface for `@pkgs/sync-engine`.
 * Import from `@pkgs/sync-engine/server` only — deep paths are not public.
 */

export { pruneMutationArtifacts } from '../mutations/server/prune-mutation-artifacts';
export {
  allocateTopicPushSeq,
  allocateTopicPushSeqs,
} from './allocate-topic-push-seq';
export { isAuthErrorBody } from './auth-error';
export {
  type CreateSyncAppDeps,
  createSyncApp,
} from './create-sync-app';
export {
  type NotifyChannelsOptions,
  notifyChannels,
} from './notify-channels';
export type { SyncAppAuth } from './sync-app-auth';
