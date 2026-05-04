/**
 * Inbound connection accepted by the room server (DO or in-memory test).
 */
export type RoomServerConnection<Identity> = {
  id: string;
  identity: Identity;
  sendJson(payload: unknown): void;
  close(code?: number, reason?: string): void;
};

export type RoomServerConnectionHandler<Identity> = (
  conn: RoomServerConnection<Identity>
) => void;

export interface RoomServerTransport<Identity> {
  start(onConnection: RoomServerConnectionHandler<Identity>): void;
  stop(): void;
}
