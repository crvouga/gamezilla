/** Optional metadata from the transport (e.g. verified sender id on non-broadcast links). */
export type TransportMessageContext = {
  senderMeta?: Record<string, unknown>
}

export interface Transport {
  publish(topic: string, payload: unknown, options?: { qos?: 0 | 1 }): void
  subscribe(
    topic: string,
    handler: (payload: unknown, context?: TransportMessageContext) => void,
  ): () => void
  onConnect(handler: () => void): () => void
  destroy(): void
}
