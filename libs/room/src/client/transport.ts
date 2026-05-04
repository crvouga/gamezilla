export type ClientTransportHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: unknown) => void;
};

/**
 * Browser/worker WebSocket (or test double): sends JSON frames to the room server.
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
