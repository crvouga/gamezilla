export interface Transport {
  publish(topic: string, payload: unknown, options?: { qos?: 0 | 1 }): void
  subscribe(topic: string, handler: (payload: unknown) => void): () => void
  onConnect(handler: () => void): () => void
  destroy(): void
}
