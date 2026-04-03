export type Message = {
  type: string;
  payload: unknown;
};

export type Command = {
  id: string;
  seq: number;
  peerId: string;
  message: Message;
};

export type Event = {
  type: string;
  payload: unknown;
};

export type State = Record<string, unknown>;

export type Vote = {
  commandId: string;
  from: string;
  vote: 'ACK' | 'REJECT';
  reason?: string;
};

export type ConsensusResult =
  | { status: 'PENDING' }
  | { status: 'COMMITTED' }
  | { status: 'REJECTED'; badActors: string[] };

export type StoreError = {
  code: string;
  message: string;
};

export type HandleResult =
  | { ok: true; value: { events: Event[] } }
  | { ok: false; error: StoreError };

export type StoreModule = {
  initialState(): State;
  handle(state: State, command: Command): HandleResult;
  reduce(state: State, event: Event): State;
};

export type SyncPolicy = {
  isSyncSource(localPeerId: string, allPeers: string[]): boolean;
};

export interface PeerStoreApi {
  dispatch(message: Message): void;
  dispatchOptimistic(event: Event): void;
  subscribe(callback: (state: State) => void): () => void;
  getState(): State;
  rehydrate(events: Event[]): void;
  requestSync(): void;
  destroy(): void;
}

export interface Transport {
  publish(topic: string, payload: unknown, options?: { qos?: 0 | 1 }): void;
  subscribe(topic: string, handler: (payload: unknown) => void): () => void;
  onConnect(handler: () => void): () => void;
  destroy(): void;
}
