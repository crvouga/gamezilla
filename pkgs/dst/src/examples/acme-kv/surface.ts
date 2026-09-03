import type { Session } from '../../host/types';
import type { AcmeKvClientHandle, AcmeKvServerHandle } from './nodes';

export type KvSurface = {
  readonly session: Session;
  readonly server: AcmeKvServerHandle;
  readonly clients: readonly AcmeKvClientHandle[];
};
