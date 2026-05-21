# Game Architecture — Leaderless Consensus + Smart Clients

## Philosophy

**Smart clients, dumb servers.** All game intelligence lives in shared client code. Servers are stateless dumb relays — they move bytes, nothing else. This follows the end-to-end principle from original internet architecture: intelligence belongs at the endpoints, not in the network.

```
Worker (HTTP)             → stateless API, game creation, auth, sync
Durable Object (WS)      → per-game room, WebSocket relay, referee
PlanetScale (DB)          → event log, reconnect recovery, player data
```

---

## Core Primitive — GameModule

```typescript
type GameModule<TState, TCommand, TEvent> = {
  initialState(): TState;
  handleCommand(input: {
    state: TState;
    command: Command<TCommand>;
  }): Result<{ events: TEvent[] }, GameError>;
  handleEvent(input: { state: TState; event: TEvent }): TState;
};
```

Three methods. All pure functions. No side effects. Runs identically on client, Durable Object, and optional server.

### Rules

- `handleCommand` is the **only** source of events — ever
- `handleEvent` is the **only** way to produce new state — ever
- UI dispatches commands, never events
- State is always derived, never mutated directly

### Derived utilities

```typescript
function reduce<TState, TEvent>(
  module: GameModule<TState, any, TEvent>,
  events: TEvent[]
): TState {
  return events.reduce(
    (state, event) => module.handleEvent({ state, event }),
    module.initialState()
  );
}
```

### Command shape

```typescript
type Command<TCommand> = {
  id: string; // for consensus dedup (ulid)
  seq: number; // for ordering
  playerId: string; // for turn validation
  payload: TCommand;
};
```

### One command produces multiple events

```typescript
// MOVE_PIECE command might produce:
[
  { type: 'PIECE_MOVED', from, to },
  { type: 'PAWN_PROMOTED', piece: 'QUEEN' },
  { type: 'CHECK_DECLARED', kingSquare: 'e8' },
  { type: 'GAME_ENDED', result: 'WHITE_WINS' },
];
```

---

## CQRS Discipline

```
Commands  — user intent, dispatched by UI, validated by handleCommand
Events    — facts, produced only by handleCommand, applied by handleEvent
State     — derived, never mutated directly, always from handleEvent
UI        — reads state, dispatches commands, never produces events
```

```
UI ──► handleCommand ──► events ──► handleEvent ──► state ──► UI
```

---

## Consensus Model — Leaderless, Peer Validated

### Participants — exactly 3, first class

```
Player A  — makes moves, validates peer moves
Player B  — makes moves, validates peer moves
Referee   — Durable Object, validates all moves, tiebreaker
```

Quorum: **2 of 3**. Any two agreeing commits the move.

### Why the referee exists

Without a referee, Player B can falsely reject Player A's legal move and there is no arbiter. The Durable Object breaks the tie:

```
Player A sends legal move:
  Player B → ACK
  Referee  → ACK
  Result   → COMMITTED (2/3)

Player A sends illegal move:
  Player B → REJECT
  Referee  → REJECT
  Result   → REJECTED (2/3)

Player B falsely rejects legal move:
  Player B → REJECT  ← lying
  Referee  → ACK
  Result   → COMMITTED (2/3), Player B flagged

Referee is corrupt (bug):
  Player B → ACK
  Referee  → REJECT  ← bug
  Result   → COMMITTED (2/3), Referee flagged
```

Any single participant can be dishonest. The other two always outvote them. This is Byzantine Fault Tolerance at its minimum viable configuration.

### Game modes

```typescript
type GameMode =
  | { type: 'casual' } // peer only, works offline, no referee required
  | { type: 'competitive' }; // referee required, online only
```

Competitive refuses to start without Durable Object connection. Casual works fully offline.

---

## Complete Flow

```
t=0ms   UI dispatches command
t=0ms   handleCommand validates locally → fast fail before network
t=0ms   Optimistic update → UI updates instantly
t=0ms   Command sent via WebSocket to Durable Object

t=5ms   DO receives command → validates with handleCommand → publishes ACK
t=5ms   DO forwards command to Player B via WebSocket

t=15ms  Player B receives → handleCommand validates → sends ACK via WebSocket
t=15ms  DO receives Player B ACK → quorum (2 of 3) reached

t=15ms  DO broadcasts committed event to all peers via WebSocket
t=15ms  DO persists event to PlanetScale (async, non-blocking)

t=20ms  All peers receive event → handleEvent → committed state
t=20ms  Optimistic cleared, UI re-renders with committed state
```

20ms total. One Cloudflare hop. No server authority.

### On rejection

```
Quorum rejects → rollback optimistic state
             → replay committed events only
             → flag bad actor (voted against majority)
```

---

## Transport — WebSockets via Durable Objects

Each game session is a Durable Object instance. Players connect via WebSockets. The DO is the relay and referee — same `GameModule` code runs inside the DO.

### Why Durable Objects

- **Per-game isolation** — each game is its own actor, no shared state between games
- **Co-located state** — game events live in memory on the DO, no DB round-trip for validation
- **WebSocket native** — built-in hibernatable WebSocket support, no external broker
- **Global single-instance** — exactly one DO per game, no split-brain possible
- **Auto-scales to zero** — no cost when no games are active

### Durable Object — Game Room

```typescript
export class GameRoom extends DurableObject {
  private connections = new Map<string, WebSocket>();
  private committedEvents: GameEvent[] = [];
  private consensus = new ConsensusProtocol(['playerA', 'playerB', 'referee']);

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      const { 0: client, 1: server } = new WebSocketPair();
      const playerId = url.searchParams.get('playerId')!;
      this.ctx.acceptWebSocket(server, [playerId]);
      this.connections.set(playerId, server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('not found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, raw: string) {
    const msg = JSON.parse(raw);
    const senderId = this.ctx.getTags(ws)[0];

    switch (msg.type) {
      case 'command':
        await this.handleCommand(senderId, msg.command);
        break;
      case 'vote':
        await this.handleVote(senderId, msg.vote);
        break;
    }
  }

  private async handleCommand(senderId: string, cmd: Command<unknown>) {
    const state = reduce(GameModule, this.committedEvents);
    const result = GameModule.handleCommand({ state, command: cmd });

    // referee votes immediately
    const refereeVote = result.ok ? 'ACK' : 'REJECT';
    this.consensus.record({
      commandId: cmd.id,
      from: 'referee',
      vote: refereeVote,
    });

    // forward command to other player
    this.broadcast({ type: 'peer-command', command: cmd }, senderId);
  }

  private async handleVote(senderId: string, vote: Vote) {
    const result = this.consensus.record(vote);

    if (result.status === 'COMMITTED') {
      this.broadcast({
        type: 'committed',
        commandId: vote.commandId,
        events: result.events,
      });
      result.events.forEach((e) => this.committedEvents.push(e));

      // persist to PlanetScale — async, does not block commit
      this.ctx.waitUntil(this.persistEvents(result.events));
    }

    if (result.status === 'REJECTED') {
      this.broadcast({ type: 'rejected', commandId: vote.commandId });
    }
  }

  private broadcast(msg: object, exclude?: string) {
    const raw = JSON.stringify(msg);
    for (const [id, ws] of this.connections) {
      if (id !== exclude) ws.send(raw);
    }
  }

  private async persistEvents(events: GameEvent[]) {
    // PlanetScale write — fire and forget, for reconnect recovery only
  }

  async webSocketClose(ws: WebSocket) {
    const playerId = this.ctx.getTags(ws)[0];
    this.connections.delete(playerId);
    this.broadcast({ type: 'presence', playerId, status: 'disconnected' });
  }
}
```

### Client connection

```typescript
const gameId = 'game-abc123';
const playerId = 'player-1';

const ws = new WebSocket(
  `https://api.gamezilla.app/game/${gameId}/ws?playerId=${playerId}`
);
```

The stateless Worker routes the WebSocket upgrade to the correct Durable Object by game ID:

```typescript
// Worker — routes WS upgrade to DO
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/game\/([^/]+)\/ws$/);
    if (match) {
      const gameId = match[1];
      const id = env.GAME_ROOM.idFromName(gameId);
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }
    return handleApiRequest(request, env);
  },
};
```

### Offline / P2P fallback

```typescript
// online — Durable Object via WebSocket
const transport = new DurableObjectTransport(gameId, playerId);

// offline — WebRTC direct
const transport = new WebRtcTransport(peerId);

// same engine, unaware of transport
const engine = new GameEngine(ChessModule, playerId, transport, ...);
```

---

## Compute Resources — Cloudflare Workers + Durable Objects

### Philosophy

```
Worker (stateless)      HTTP request/response           Cloudflare Workers
Durable Object          per-game room + referee   Cloudflare Durable Objects
PlanetScale             event log + game registry       PlanetScale (serverless MySQL)
```

### Service contracts

```
Worker (stateless):
  IN:   HTTP requests from clients
  OUT:  HTTP responses, routes WS upgrades to DOs
  DB:   read + write (PlanetScale) for non-game queries
  DO:   routes game traffic to Durable Objects
  Logic: API handlers, auth, game creation, sync

Durable Object (GameRoom):
  IN:   WebSocket messages from players
  OUT:  WebSocket messages to players
  DB:   async write to PlanetScale (event log persistence)
  Logic: relay, referee validation, consensus coordination
  State: in-memory committed events, WebSocket connections

PlanetScale:
  Role: event log, game registry, player data
  Source of truth for reconnect recovery only
  Clients never write directly — local first
```

### Scaling model

```
Worker           stateless, scales automatically        Cloudflare edge network
                 runs in 300+ locations globally
                 zero config, zero ops

Durable Object   one instance per game                  Cloudflare global network
                 auto-created on first request
                 hibernates when idle (zero cost)
                 migrates to optimal location automatically

PlanetScale      serverless MySQL, scales automatically
                 read replicas in multiple regions
                 branching for schema changes
```

### Why this is simpler than EMQX + App Runner

```
Before (EMQX architecture):
  4 EMQX nodes globally              → config, monitoring, cluster gossip
  2 App Runner services              → Docker images, scaling config
  Aurora Serverless                   → VPC, security groups
  Route 53 latency routing           → DNS config per region
  Shared MQTT subscriptions           → competing consumer setup
  Total moving parts: ~12

After (Cloudflare + PlanetScale):
  1 Worker (stateless)                → zero config scaling
  1 Durable Object class              → per-game isolation, auto-scales
  PlanetScale                         → serverless, zero ops
  Total moving parts: 3
```

---

## GameEngine

```typescript
export class GameEngine<TState, TCommand, TEvent> {
  private committedEvents: TEvent[] = [];
  private optimisticEvents: TEvent[] = [];

  constructor(
    private module: GameModule<TState, TCommand, TEvent>,
    private playerId: string,
    private transport: GameTransportPort,
    private onStateChange: (state: TState) => void,
    private onError: (error: GameError) => void
  ) {
    transport.onMessage((msg) => this.handleMessage(msg));
  }

  dispatch(command: TCommand) {
    const cmd = buildCommand(command, this.playerId, this.committedState.seq);

    const result = this.module.handleCommand({
      state: this.committedState,
      command: cmd,
    });
    if (!result.ok) {
      this.onError(result.error);
      return;
    }

    this.applyOptimistic(cmd.id, result.value.events);
    this.transport.send({ type: 'command', command: cmd });
  }

  private handlePeerCommand(cmd: Command<TCommand>) {
    const result = this.module.handleCommand({
      state: this.committedState,
      command: cmd,
    });
    this.transport.send({
      type: 'vote',
      vote: {
        commandId: cmd.id,
        from: this.playerId,
        vote: result.ok ? 'ACK' : 'REJECT',
      },
    });
  }

  private handleCommitted(payload: { commandId: string; events: TEvent[] }) {
    this.optimisticEvents = this.optimisticEvents.filter(
      (e) => e.commandId !== payload.commandId
    );
    payload.events.forEach((event) => this.committedEvents.push(event));
    this.emitState();
  }

  private handleRejected(payload: { commandId: string }) {
    this.rollbackOptimistic(payload.commandId);
    this.emitState();
  }

  private get committedState() {
    return reduce(this.module, this.committedEvents);
  }
  private get optimisticState() {
    return reduce(this.module, [
      ...this.committedEvents,
      ...this.optimisticEvents,
    ]);
  }
  private emitState() {
    this.onStateChange(this.optimisticState);
  }
}
```

---

## ConsensusProtocol

```typescript
export class ConsensusProtocol {
  private votes = new Map<string, Map<string, 'ACK' | 'REJECT'>>();

  constructor(private peers: string[]) {}

  private get quorum() {
    return Math.floor(this.peers.length / 2) + 1;
  }

  record(vote: Vote): ConsensusResult {
    if (!this.votes.has(vote.commandId))
      this.votes.set(vote.commandId, new Map());
    this.votes.get(vote.commandId)!.set(vote.from, vote.vote);
    return this.evaluate(vote.commandId);
  }

  private evaluate(commandId: string): ConsensusResult {
    const votes = this.votes.get(commandId)!;
    const acks = [...votes.values()].filter((v) => v === 'ACK').length;
    const rejects = [...votes.values()].filter((v) => v === 'REJECT').length;
    if (acks >= this.quorum) return { status: 'COMMITTED' };
    if (rejects >= this.quorum) return { status: 'REJECTED' };
    return { status: 'PENDING' };
  }
}
```

---

## Ports and Adapters

```typescript
export interface GameTransportPort {
  send(message: Message): Promise<void>;
  onMessage(handler: (message: Message) => void): () => void;
  onDisconnect(handler: () => void): () => void;
}
```

### Adapters matrix

```
Environment         GameTransport              Room
──────────────────────────────────────────────────────────────
Online              DurableObjectTransport     Durable Object (GameRoom)
Offline P2P         WebRtcTransport            Local (in-memory)
Local dev           WebSocketTransport         Bun WebSocket server (same logic)
```

### DurableObjectTransport

```typescript
export class DurableObjectTransport implements GameTransportPort {
  private ws: WebSocket;
  private handlers = new Set<(msg: Message) => void>();

  constructor(gameId: string, playerId: string) {
    this.ws = new WebSocket(
      `${process.env.API_URL}/game/${gameId}/ws?playerId=${playerId}`
    );
    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      this.handlers.forEach((h) => h(msg));
    };
  }

  async send(message: Message) {
    this.ws.send(JSON.stringify(message));
  }

  onMessage(handler: (msg: Message) => void) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onDisconnect(handler: () => void) {
    this.ws.onclose = handler;
    return () => {
      this.ws.onclose = null;
    };
  }
}
```

---

## React Hook

```typescript
export function useGame(gameId: string, playerId: string) {
  const [state, setState] = useState<ChessState>(ChessModule.initialState());
  const [error, setError] = useState<GameError | null>(null);
  const engineRef = useRef<GameEngine<...>>();

  useEffect(() => {
    const transport = new DurableObjectTransport(gameId, playerId);
    engineRef.current = new GameEngine(ChessModule, playerId, transport, setState, setError);

    gameApi.getEvents(gameId).then(events => {
      events.forEach(e => engineRef.current!.applyCommitted(e));
    });

    return () => transport.disconnect();
  }, [gameId]);

  return {
    state,
    error,
    dispatch: (cmd: ChessCommand) => engineRef.current?.dispatch(cmd),
  };
}
```

### Component usage

```typescript
function ChessGame({ gameId, playerId }: Props) {
  const { state, error, dispatch } = useGame(gameId, playerId);

  return (
    <View>
      <ChessBoard
        state={state}
        onMove={(from, to) => dispatch({ type: 'MOVE_PIECE', from, to })}
      />
      {error && <ErrorBanner error={error} />}
    </View>
  );
}
```

---

## Durable Object — Peer, Never Authority

The Durable Object participates in consensus using identical `GameModule` code. It is always a peer (the referee), never a ruler. Its vote counts as 1 of 3 — same as any player.

### Reconnect recovery

State is event sourced — reconnect fetches missed events from PlanetScale and replays:

```typescript
ws.onclose = async () => {
  const missed = await gameApi.getEvents(gameId, { fromSeq: lastKnownSeq });
  setState(reduce(GameModule, missed));
  reconnect();
};
```

The DO also rehydrates from PlanetScale on cold start (after hibernation or migration):

```typescript
export class GameRoom extends DurableObject {
  private async rehydrate(gameId: string) {
    if (this.committedEvents.length > 0) return; // already warm
    const events = await this.env.DB.query(
      'SELECT * FROM game_events WHERE game_id = ? ORDER BY seq ASC',
      [gameId]
    );
    this.committedEvents = events;
  }
}
```

### DO down handling

Cloudflare guarantees DO availability — if the host goes down, the DO migrates automatically. But for defense in depth:

```typescript
const WS_CONNECT_TIMEOUT = 5_000;

setTimeout(() => {
  if (ws.readyState !== WebSocket.OPEN) {
    onRefereeUnavailable();
  }
}, WS_CONNECT_TIMEOUT);
```

---

## Wrangler Configuration

```toml
name = "gamezilla-api"
main = "src/api.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[observability]
enabled = true

[[durable_objects.bindings]]
name = "GAME_ROOM"
class_name = "GameRoom"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["GameRoom"]

[vars]
ENVIRONMENT = "production"
```

---

## Infrastructure Summary

```
Worker (stateless)  Cloudflare Workers
                    HTTP request/response — API, auth, game creation, sync
                    Routes WebSocket upgrades to Durable Objects
                    Runs at 300+ edge locations globally
                    Scales: automatic, zero config

Durable Object      Cloudflare Durable Objects
                    Per-game room — WebSocket relay + referee
                    In-memory game state for fast validation
                    Hibernatable WebSockets — zero cost when idle
                    Async persistence to PlanetScale
                    Scales: one instance per game, auto-created, auto-migrated

PlanetScale         Serverless MySQL
                    Event log, game registry, player data
                    Source of truth for reconnect recovery only
                    Clients never write directly — local first
                    Read replicas for global low-latency reads

Local dev           Real local PostgreSQL (`@pkgs/postgres`) + pgweb GUI + Bun API — no Docker
                    Doppler `local` `DB_URL` → `postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable`
                    Pre-connected pgweb GUI auto-launches at `http://127.0.0.1:5555` (disable with `PG_GUI=off`).
                    `bun run dev` (root) starts pg + api + client together; `db:migrate` once: `bun run --filter @apps/api db:migrate`
```

### Scale estimates

```
Scale              Concurrent    Monthly cost (est.)
────────────────────────────────────────────────────
Your game (early)  1k            ~$10 (Workers free tier + PS hobby)
Growing            10k           ~$50
Lichess            147k          ~$500
Chess.com          500k-1M       ~$2,000-5,000
```

Cloudflare Workers: 10M requests/month free, then $0.50/M. Durable Objects: first 1M requests free, $0.15/M after. PlanetScale: hobby tier free, scaler from $39/month.

### Local Postgres (managed cluster)

`@pkgs/postgres` runs a real PostgreSQL server in the foreground so Turbo's persistent-task lifecycle owns it, with [`pgweb`](https://github.com/sosedoff/pgweb) auto-launched as a sibling pre-connected GUI. The wrapper:

- spawns `postgres` directly (no double-fork) inside its own process group, so `SIGINT`/`SIGTERM` from the dev shell can never leave an orphaned cluster behind,
- after `pg_isready` succeeds, spawns `pgweb` (also in the process group) pointed at the local DB URL — no manual connection step,
- reconciles a stale `postmaster.pid` from a previous abrupt exit before starting,
- on shutdown stops `pgweb` first, then runs `pg_ctl stop -m fast` and escalates to `SIGINT → SIGTERM → SIGKILL` on the recorded postmaster PID if that fails,
- writes its own `wrapper.pid` so `kill` only ever signals the cluster we manage (it will not terminate other Postgres servers that happen to bind the same port),
- tees the postmaster log to `pkgs/postgres/.postgres/run/postgres.log` and pgweb's output to `pkgs/postgres/.postgres/run/pgweb.log`; both are forwarded to the terminal with `pg-server:` / `pg-gui:` prefixes,
- treats GUI failures as non-fatal: missing `pgweb` binary or port collision logs a warning and the cluster keeps running.

```bash
# From repo root — turbo dev launches @pkgs/postgres alongside the api + client.
bun run dev

# Or run just Postgres in this terminal (foreground; Ctrl-C to stop):
bun run --filter @pkgs/postgres dev

# Graceful stop (only signals our managed wrapper + cluster):
bun run --filter @pkgs/postgres kill

# Apply migrations against the running cluster:
DOPPLER_CONFIG=local doppler run -- bun run --filter @apps/api db:migrate
```

Set Doppler `local` `DB_URL` to match the server log (`postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable`).

Required tooling: `postgres`, `pg_ctl`, `initdb`, `pg_isready`, `pgweb`. Enforced by `bun run infra setup` and `status` via the `PostgresDep` and `PgwebDep` classes.

| Platform | Postgres install                                                                                                           | pgweb install                                                            | Notes                                                                                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | `brew install postgresql@17`                                                                                               | `brew install pgweb`                                                     | Homebrew installs keg-only; the wrapper auto-discovers `/opt/homebrew/opt/postgresql@17/bin` and `/usr/local/opt/...`. Override with `PG_BIN_DIR=$(brew --prefix postgresql@17)/bin`. |
| Linux    | `apt-get install postgresql` (Debian/Ubuntu), `dnf install postgresql-server` (Fedora/RHEL), `pacman -S postgresql` (Arch) | Download from https://github.com/sosedoff/pgweb/releases and put on PATH | The wrapper also probes `/usr/lib/postgresql/<version>/bin` automatically.                                                                                                            |
| Windows  | Run dev inside WSL2                                                                                                        | Install pgweb inside WSL2                                                | Native Windows is not supported; the wrapper exits with a clear install hint if invoked there.                                                                                        |

Tunables (all optional, env-driven):

- Cluster: `PG_HOST`, `PG_PORT`, `PG_DATA_DIR`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`, `PG_LOCALE`, `PG_ENCODING`, `PG_STARTUP_TIMEOUT_MS`, `PG_SHUTDOWN_TIMEOUT_MS`, `PG_BIN_DIR`.
- GUI sidecar: `PG_GUI` (set to `off`/`0`/`false` to disable; default off in CI), `PG_GUI_HOST` (default `127.0.0.1`), `PG_GUI_PORT` (default `5555` — picked to sit next to the Postgres port and avoid Expo Web's `8081`), `PG_GUI_BIN` (force a specific `pgweb` binary).

---

## Dependencies

```typescript
import { ulid } from 'ulid'; // command IDs
import { Result, ok, err } from 'neverthrow'; // Result type
```

Everything else — `GameModule`, `GameEngine`, `ConsensusProtocol`, `GameTransportPort` — is your code. ~500 lines total. No framework needed.

---

## Key Invariants

1. Events come only from `handleCommand` — never from outside
2. State comes only from `handleEvent` — never mutated directly
3. UI dispatches commands — never events
4. Durable Object is a peer (referee) — never an authority
5. Workers are stateless — game state lives only in Durable Objects
6. Worker handles HTTP only — never holds WebSocket connections directly
7. Durable Object handles WebSockets only — never serves HTTP API responses
8. `GameModule` is pure — no side effects, no network, no DB
9. Same `GameModule` code runs on all participants — client, Durable Object, offline
10. Clients never write directly to PlanetScale — local first, sync via Worker
11. No Redis — Durable Object holds game state in memory, PlanetScale for cold start only
12. No message broker — Durable Objects are the coordination layer
13. No Docker in production — Cloudflare runs everything at the edge
