export type ClientCheckpoint = {
  readonly sql: Uint8Array;
  readonly kv: Readonly<Record<string, string>>;
};

export type ActorCheckpointPort = {
  capture(): Promise<ClientCheckpoint>;
  restore(checkpoint: ClientCheckpoint): Promise<void>;
};

export type ClientCheckpointPort = {
  capture(id: string): Promise<ClientCheckpoint>;
  restore(id: string, checkpoint: ClientCheckpoint): Promise<void>;
};
