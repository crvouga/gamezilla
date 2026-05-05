export type ClientTransportHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: unknown) => void;
};

/**
 * Network port the {@link Room} engine pushes/pulls JSON wire frames over.
 * Every transport adapter (browser WebSocket, loopback test double,
 * future WebRTC, etc.) must satisfy this contract.
 */
export interface ClientTransport {
  readonly isConnected: boolean;
  /** May return a Promise (e.g. loopback tests) so callers can await `Promise.resolve(transport.connect())`. */
  connect(): void | Promise<void>;
  sendJson(payload: unknown): void;
  subscribe(handler: (raw: unknown) => void): () => void;
  onHandlers(h: ClientTransportHandlers): () => void;
  destroy(): void;
}
