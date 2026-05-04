/**
 * Durable Object that relays WebSocket text frames between all clients on the
 * same topic (one DO instance per `idFromName(topic)`).
 *
 * Uses WebSocket hibernation (`acceptWebSocket`) so idle rooms can sleep.
 * Frames with `ch === "presence"` are handled for account↔peer mapping; all
 * other JSON payloads are broadcast as room envelopes.
 */

const ACCOUNT_HEADER = 'x-gamezilla-account-id';

type WsMeta = { accountId: string; peerId: string | null };

export class RoomRelay implements DurableObject {
  protected readonly ctx: DurableObjectState;
  readonly _env: unknown;
  private readonly wsMeta = new WeakMap<WebSocket, WsMeta>();

  constructor(ctx: DurableObjectState, env: unknown) {
    this.ctx = ctx;
    this._env = env;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket Upgrade', { status: 426 });
    }
    const accountId = request.headers.get(ACCOUNT_HEADER)?.trim() ?? '';
    if (accountId.length === 0) {
      return new Response('missing account header', { status: 401 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.wsMeta.set(server, { accountId, peerId: null });
    this.ctx.acceptWebSocket(server);
    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit);
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    const data =
      typeof message === 'string' ? message : new TextDecoder().decode(message);

    let parsed: unknown;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch {
      await this.broadcastRaw(data);
      return;
    }

    if (this.isPresenceFrame(parsed)) {
      await this.handlePresence(ws, parsed);
      return;
    }

    await this.broadcastRaw(data);
  }

  private isPresenceFrame(
    v: unknown
  ): v is { ch: 'presence'; kind: string; peerId?: string } {
    return (
      v !== null &&
      typeof v === 'object' &&
      'ch' in v &&
      (v as { ch?: unknown }).ch === 'presence' &&
      'kind' in v &&
      typeof (v as { kind?: unknown }).kind === 'string'
    );
  }

  private async handlePresence(
    ws: WebSocket,
    frame: { ch: 'presence'; kind: string; peerId?: string }
  ): Promise<void> {
    const meta = this.wsMeta.get(ws);
    if (meta === undefined) return;

    if (frame.kind === 'hello') {
      const peerId = frame.peerId;
      if (typeof peerId !== 'string' || peerId.length === 0) {
        return;
      }
      meta.peerId = peerId;
      const snapshot = this.buildPresenceSnapshot();
      try {
        ws.send(
          JSON.stringify({
            ch: 'presence',
            kind: 'snapshot',
            peers: snapshot,
          })
        );
      } catch {
        // closed
      }
      await this.broadcastPresence(
        { ch: 'presence', kind: 'join', peerId, accountId: meta.accountId },
        ws
      );
      return;
    }
  }

  private buildPresenceSnapshot(): { peerId: string; accountId: string }[] {
    const out: { peerId: string; accountId: string }[] = [];
    for (const socket of this.ctx.getWebSockets()) {
      const m = this.wsMeta.get(socket);
      const pid = m?.peerId;
      if (m !== undefined && typeof pid === 'string' && pid.length > 0) {
        out.push({ peerId: pid, accountId: m.accountId });
      }
    }
    return out;
  }

  private async broadcastPresence(
    payload: Record<string, unknown>,
    except: WebSocket
  ): Promise<void> {
    const text = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === except) continue;
      try {
        socket.send(text);
      } catch {
        // peer may be closing
      }
    }
  }

  private async broadcastRaw(data: string): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(data);
      } catch {
        // peer may be closing
      }
    }
  }

  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string
  ): Promise<void> {
    const meta = this.wsMeta.get(ws);
    const peerId = meta?.peerId;
    if (typeof peerId === 'string' && peerId.length > 0 && meta !== undefined) {
      await this.broadcastPresence(
        { ch: 'presence', kind: 'leave', peerId, accountId: meta.accountId },
        ws
      );
    }
  }
}
