export type Message = {
  type: string
  payload: unknown
}

export type Command = {
  id: string
  seq: number
  peerId: string
  message: Message
}

export type Event = {
  type: string
  payload: unknown
}

export type State = Record<string, unknown>

export type StoreError = {
  code: string
  message: string
}

export type HandleResult =
  | { ok: true; value: { events: Event[] } }
  | { ok: false; error: StoreError }

export type StoreModule = {
  initialState(): State
  handle(state: State, command: Command): HandleResult
  reduce(state: State, event: Event): State
}

export type SyncPolicy = {
  isSyncSource(localPeerId: string, allPeers: string[]): boolean
}

export interface PeerStoreApi {
  dispatch(message: Message): void
  dispatchOptimistic(event: Event): void
  subscribe(callback: (state: State) => void): () => void
  getState(): State
  getCommittedState(): State
  getCommittedEvents(): Event[]
  rehydrate(events: Event[]): void
  requestSync(): void
  destroy(): void
}

export interface Transport {
  publish(topic: string, payload: unknown, options?: { qos?: 0 | 1 }): void
  subscribe(topic: string, handler: (payload: unknown) => void): () => void
  onConnect(handler: () => void): () => void
  destroy(): void
}

/**
 * Pluggable authority that controls the commit protocol.
 *
 * Implementations decide WHO validates commands and HOW commits are decided:
 * - ConsensusAuthority: all peers vote, quorum-based (P2P)
 * - ServerAuthority: a designated server validates and commits authoritatively
 */
export interface Authority {
  bind(sink: AuthoritySink): void
  onLocalCommand(command: Command, proposedEvents: Event[]): void
  onMessage(message: unknown): void
  reset(): void
  destroy(): void
}

export type AuthoritySink = {
  commit(commandId: string, events: Event[]): void
  reject(commandId: string): void
  reportBadActor(peerId: string, commandId: string): void
  broadcast(message: unknown): void
  getCommittedState(): State
  getModule(): StoreModule
}
