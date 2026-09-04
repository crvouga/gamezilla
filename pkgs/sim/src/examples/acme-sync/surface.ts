import type { Session } from '../../host/types';
import type { SyncClientHandle, SyncServerHandle } from './nodes';

export type SyncSurface = {
  readonly session: Session;
  readonly server: SyncServerHandle;
  readonly clients: readonly SyncClientHandle[];
};
