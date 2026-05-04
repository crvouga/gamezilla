/**
 * Durable Object that relays WebSocket text frames between all clients on the
 * same topic (one DO instance per `idFromName(topic)`).
 *
 * Uses WebSocket hibernation (`acceptWebSocket`) so idle rooms can sleep.
 */
export class RoomRelay implements DurableObject {
  constructor(
    protected readonly ctx: DurableObjectState,
    readonly _env: unknown
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket Upgrade', { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit);
  }

  async webSocketMessage(
    _ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    const data =
      typeof message === 'string'
        ? message
        : new TextDecoder().decode(message);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(data);
      } catch {
        // peer may be closing
      }
    }
  }

  async webSocketClose(_ws: WebSocket): Promise<void> {
    // hibernation API: no-op; runtime removes socket from getWebSockets()
  }
}
