import type { Base } from '../../harness/base-surface';
import type { NodeId } from '../../models/network';
import type { AcmeKvClientHandle, AcmeKvServerHandle } from './nodes';

export type KvSurface = Base & {
  put(
    clientId: NodeId,
    key: string,
    value: string,
    writeId?: number
  ): Promise<void>;
  knownKeys(): readonly string[];
  versionsMonotonic(): boolean;
  cachesEqualServer(): boolean;
  sawTiebreak(): boolean;
};

export type KvExtension = {
  put(
    clientId: NodeId,
    key: string,
    value: string,
    writeId?: number
  ): Promise<void>;
  knownKeys(): readonly string[];
  versionsMonotonic(): boolean;
  cachesEqualServer(): boolean;
  sawTiebreak(): boolean;
};

export type AcmeKvWorld = {
  readonly nodes: {
    readonly server: AcmeKvServerHandle;
    readonly client: ReadonlyMap<string, AcmeKvClientHandle>;
  };
};
