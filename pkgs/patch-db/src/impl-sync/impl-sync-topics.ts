import { asKeyword, type Keyword } from '@pkgs/keyword';

/** Topic for sync errors. Subscribe to surface push/poll failures to the UI after consecutive failures. */
export const SYNC_ERROR_TOPIC: Keyword = asKeyword('patch-db.bus/sync-error');

export type SyncErrorEvent = {
  source: 'push' | 'poll';
  error: unknown;
};
