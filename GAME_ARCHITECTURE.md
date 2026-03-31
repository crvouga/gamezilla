# Game Architecture — Leaderless Consensus + Smart Clients

## Philosophy

**Smart clients, dumb servers.** All game intelligence lives in shared client code. Servers are stateless dumb relays — they move bytes, nothing else. This follows the end-to-end principle from original internet architecture: intelligence belongs at the endpoints, not in the network.

```
ReqRes (HTTP)        → clients sync local DBs, create games
PubSub (EMQX MQTT)   → global broker, clients connect to nearest node
Worker (MQTT sub)    → referee validates commands, persists event log
Aurora (DB)          → event log, reconnect recovery, never primary storage
```

---

## Core Primitive — GameModule

```typescript
type GameModule<TState, TCommand, TEvent> = {
  initialState(): TState;
  handleCommand(input: { state: TState; command: Command<TCommand> }): Result<{ events: TEvent[] }, GameError>;
  handleEvent(input: { state: TState; event: TEvent }): TState;
}
```

Three methods. All pure functions. No side effects. Runs identically on client, referee, and optional server.

### Rules

- `handleCommand` is the **only** source of events — ever
- `handleEvent` is the **only** way to produce new state — ever
- UI dispatches commands, never events
- State is always derived, never mutated directly

### Derived utilities

```typescript
// reduce is just handleEvent folded over a list — not part of the interface
function reduce<TState, TEvent>(
  module: GameModule<TState, any, TEvent>,
  events: TEvent[],
): TState {
  return events.reduce(
    (state, event) => module.handleEvent({ state, event }),
    module.initialState(),
  );
}
```

### Command shape

```typescript
type Command<TCommand> = {
  id: string;       // for consensus dedup (ulid)
  seq: number;      // for ordering
  playerId: string; // for turn validation
  payload: TCommand;
}
```

### One command produces multiple events

```typescript
// MOVE_PIECE command might produce:
[
  { type: 'PIECE_MOVED', from, to },
  { type: 'PAWN_PROMOTED', piece: 'QUEEN' },   // if applicable
  { type: 'CHECK_DECLARED', kingSquare: 'e8' }, // if applicable
  { type: 'GAME_ENDED', result: 'WHITE_WINS' }, // if checkmate
]
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

### Topics

```
games/{gameId}/commands   ← players publish (intents)
games/{gameId}/votes      ← all peers publish (ACK/REJECT)
games/{gameId}/events     ← committed facts (immutable)
games/{gameId}/presence   ← connection lifecycle
```

Clients never publish to `events`. Events are only published after quorum is reached.

---

## Consensus Model — Leaderless, Peer Validated

### Participants — exactly 3, first class

```
Player A  — makes moves, validates peer moves
Player B  — makes moves, validates peer moves
Referee   — first class role in the app, validates all moves, tiebreaker
```

Quorum: **2 of 3**. Any two agreeing commits the move.

### Why the referee exists

Without a referee, Player B can falsely reject Player A's legal move and there is no arbiter. The referee breaks the tie:

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

Referee is corrupt:
  Player B → ACK
  Referee  → REJECT  ← corrupt
  Result   → COMMITTED (2/3), Referee flagged
```

Any single participant can be dishonest. The other two always outvote them. This is Byzantine Fault Tolerance at its minimum viable configuration.

### This model has no canonical name — closest descriptions

- **Leaderless consensus** — no single node has authority
- **PBFT (Practical Byzantine Fault Tolerance)** — closest algorithm, three phases map to commands/votes/events
- **Witnessed consensus with event sourcing** — plain language description

### Game modes

```typescript
type GameMode =
  | { type: 'casual' }      // peer only, works offline, no referee required
  | { type: 'competitive' } // referee required, online only
```

Competitive refuses to start without referee connection. Casual works fully offline.

---

## Complete Flow

```
t=0ms   UI dispatches command
t=0ms   handleCommand validates locally → fast fail before network
t=0ms   Optimistic update → UI updates instantly
t=0ms   Command published to pub/sub box

t=10ms  Player B receives → handleCommand validates → publishes ACK
t=10ms  Referee receives  → handleCommand validates → publishes ACK

t=20ms  Mover receives 2 ACKs → quorum (2 of 3) reached
t=20ms  Mover publishes committed event to games/{gameId}/events

t=30ms  All peers receive event → handleEvent → committed state
t=30ms  Optimistic cleared, UI re-renders with committed state
```

30ms total. One EMQX hop. No server authority.

### On rejection

```
Quorum rejects → rollback optimistic state
             → replay committed events only
             → flag bad actor (voted against majority)
```

---

## Transport — Smart Clients, MQTT + EMQX

MQTT is the protocol in all environments. Same client code, same topics, same behavior — only the broker URL changes.

```
Production:  EMQX cluster (4 nodes globally)   wss://mqtt.yourgame.com/mqtt
Local dev:   EMQX single node (Docker)          mqtt://localhost:1883
```

EMQX handles cross-node routing natively — clients connect to any node, messages reach all subscribers regardless of which node they're on. No consistent hashing needed on the client.

### MQTT Adapter

```typescript
// shared/adapters/mqtt.adapter.ts
import * as mqtt from 'mqtt';

export class MqttAdapter implements PubSubPort {
  private client: mqtt.MqttClient;
  private handlers = new Map<string, Set<(payload: object) => Promise<void>>>();

  constructor(url: string) {
    this.client = mqtt.connect(url);

    this.client.on('message', (topic, message) => {
      const payload = JSON.parse(message.toString());
      this.handlers.get(topic)?.forEach(h => h(payload));
    });
  }

  async publish(topic: string, payload: object) {
    await this.client.publishAsync(topic, JSON.stringify(payload), { qos: 0 });
  }

  subscribe(topic: string, handler: (payload: object) => Promise<void>) {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
      this.client.subscribe(topic);
    }
    this.handlers.get(topic)!.add(handler);
    return () => this.handlers.get(topic)?.delete(handler);
  }
}
```

### Client connection — dead simple

No routing logic. Route 53 latency-based routing sends clients to nearest EMQX node automatically:

```typescript
// one URL, forever — Route 53 handles geography
const pubsub = new MqttAdapter(process.env.PUBSUB_URL);
// Tokyo client    → ap-northeast-1 node
// London client   → eu-west-1 node
// New York client → us-east-1 node
```

### Offline / P2P fallback

```typescript
// online — EMQX cluster
const transport = new MqttTransport(process.env.PUBSUB_URL);

// offline — WebRTC direct
const transport = new WebRtcTransport(peerId);

// same engine, unaware of transport
const engine = new GameEngine(ChessModule, playerId, transport, ...);
```

---

## Compute Resources — Two App Runner Services + EMQX

### Philosophy

```
ReqRes   synchronous request/response    HTTP only         App Runner
Worker   asynchronous message processing MQTT sub only     App Runner
PubSub   asynchronous message relay      MQTT broker       EMQX cluster
```

PubSub is not an app — it is a deployment of EMQX. Zero application code. Config only.

### Service contracts

```
ReqRes:
  IN:   HTTP requests from clients
  OUT:  HTTP responses + MQTT publish to EMQX
  DB:   read + write (Aurora)
  MQTT: publish only — never subscribes

EMQX (PubSub):
  IN:   MQTT from clients + Worker + ReqRes
  OUT:  MQTT to clients + Worker
  DB:   never touches
  HTTP: never touches
  Logic: zero — pure broker, no application code

Worker:
  IN:   MQTT from EMQX ($share/workers/# shared subscription)
  OUT:  MQTT publish back to EMQX
  DB:   read + write (Aurora)
  HTTP: never touches clients
```

### Scaling model

```
ReqRes   round robin replicas         App Runner load balancer
         scale trigger: request volume

EMQX     4 nodes globally             Route 53 latency routing
         scale trigger: geography     NOT capacity — 1 node handles 1M connections
         add nodes for new regions    not for more users

Worker   competing consumers          MQTT shared subscriptions
         scale trigger: message throughput
```

### EMQX — 4 nodes handles Chess.com scale

```
Chess.com peak: ~1M concurrent connections
EMQX per node:  ~1M connections (benchmarked, Erlang/OTP actor model)

Nodes needed for capacity:   1
Nodes needed for geography:  4

Node layout:
  us-east-1        North + South America   ~250k connections
  eu-west-1        Europe + Africa         ~250k connections
  ap-northeast-1   Japan, Korea, China     ~250k connections
  ap-southeast-1   India, SEA, Australia   ~250k connections

Instance per node: c6g.2xlarge (8 vCPU, 16GB) = $200/month
Total EMQX cost:   4 × $200 = $800/month for Chess.com scale
```

EMQX cluster gossip routes messages between nodes natively. A game where Player A is on the Tokyo node and Player B is on the London node works automatically — no application code handles this.

### Worker — competing consumers via shared subscriptions

MQTT shared subscriptions ensure exactly one Worker instance processes each message:

```typescript
// worker/main.ts
const mqtt = connect(process.env.PUBSUB_URL);

// $share/{group}/{topic} — only one Worker gets each message
mqtt.subscribe('$share/workers/games/+/commands');  // referee validation
mqtt.subscribe('$share/workers/sync/+/mutations');  // reconciliation

mqtt.on('message', async (topic, payload) => {
  if (topic.includes('/commands')) await handleCommand(topic, payload);
  if (topic.includes('/mutations')) await handleMutation(topic, payload);
});
```

### Worker — game state from Aurora, no Redis needed

Worker fetches game state directly from Aurora. Redis is not needed because:

- Worker is not in the critical path — quorum reached on Player B + Worker ACK in parallel
- Worker latency only matters in dispute resolution (rare)
- Aurora in same region ~5ms — Redis would save 2ms, not worth the ops cost
- Event sourced state is fully derivable from event log — no cache coherence problems

### Worker latency — not in critical path

```
Happy path (no dispute):
  Player B ACK:    ~10ms  ← quorum reached here, game commits
  Worker ACK:      ~20ms  ← arrives after commit, irrelevant

Dispute path (Player B lies):
  Player B REJECT: ~10ms
  Worker ACK:      ~20ms  ← tiebreaker, commits game
  Total:           ~20ms  ← invisible in turn-based chess

Worker down:
  No quorum in dispute → timeout after 5s → surface to user
```

### Worker down handling

```typescript
const QUORUM_TIMEOUT = 5_000;

setTimeout(() => {
  if (consensus.status === 'PENDING') {
    onRefereeUnavailable();
  }
}, QUORUM_TIMEOUT);
```

### CDK — two App Runner services, one Docker image

```typescript
const services = [
  { name: 'ReqRes', port: 3000, minSize: 1, maxSize: 10 },
  { name: 'Worker', port: 3000, minSize: 1, maxSize: 20 },
];

services.forEach(({ name, port, minSize, maxSize }) => {
  new apprunner.Service(stack, name, {
    source: apprunner.Source.fromEcr({
      imageConfiguration: {
        port,
        environmentVariables: {
          SERVICE: name,
          DATABASE_URL: cluster.clusterEndpoint.socketAddress,
          PUBSUB_URL: process.env.EMQX_URL,
        },
      },
      repository: ecrRepo,
      tag: 'latest',
    }),
    autoScalingConfiguration: new apprunner.AutoScalingConfiguration(
      stack, `${name}Scale`, { minSize, maxSize }
    ),
  });
});
```

`SERVICE` env var determines which `main.ts` boots. Same Docker image for both.

---

## GameEngine

```typescript
export class GameEngine<TState, TCommand, TEvent> {
  private committedEvents: TEvent[] = [];
  private optimisticEvents: TEvent[] = [];
  private consensus: ConsensusProtocol;

  constructor(
    private module: GameModule<TState, TCommand, TEvent>,
    private playerId: string,
    private transport: GameTransportPort,
    private onStateChange: (state: TState) => void,
    private onError: (error: GameError) => void,
  ) {
    this.consensus = new ConsensusProtocol(transport.peers);
    transport.onMessage(msg => this.handleMessage(msg));
  }

  // UI entry point — only public method
  dispatch(command: TCommand) {
    const cmd = buildCommand(command, this.playerId, this.committedState.seq);

    const result = this.module.handleCommand({ state: this.committedState, command: cmd });
    if (!result.ok) { this.onError(result.error); return; }

    this.applyOptimistic(cmd.id, result.value.events);
    this.transport.publish(`games/${gameId}/commands`, cmd);
  }

  // peer sent command — validate and vote
  private handlePeerCommand(cmd: Command<TCommand>) {
    const result = this.module.handleCommand({ state: this.committedState, command: cmd });
    this.transport.publish(`games/${gameId}/votes`, {
      commandId: cmd.id,
      from: this.playerId,
      vote: result.ok ? 'ACK' : 'REJECT',
    });
  }

  // vote received — check quorum
  private handleVote(vote: Vote) {
    const result = this.consensus.record(vote);
    if (result.status === 'COMMITTED') this.publishEvent(vote.commandId);
    if (result.status === 'REJECTED') { this.rollbackOptimistic(vote.commandId); this.flagBadActor(result); }
  }

  // committed event — apply to state
  private handleCommittedEvent(payload: { commandId: string; events: TEvent[] }) {
    this.optimisticEvents = this.optimisticEvents.filter(e => e.commandId !== payload.commandId);
    payload.events.forEach(event => {
      this.committedEvents.push(event);
    });
    this.emitState();
  }

  // UI always sees optimistic state on top of committed
  private get committedState() { return reduce(this.module, this.committedEvents); }
  private get optimisticState() { return reduce(this.module, [...this.committedEvents, ...this.optimisticEvents]); }
  private emitState() { this.onStateChange(this.optimisticState); }
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
    if (!this.votes.has(vote.commandId)) this.votes.set(vote.commandId, new Map());
    this.votes.get(vote.commandId)!.set(vote.from, vote.vote);
    return this.evaluate(vote.commandId);
  }

  private evaluate(commandId: string): ConsensusResult {
    const votes = this.votes.get(commandId)!;
    const acks = [...votes.values()].filter(v => v === 'ACK').length;
    const rejects = [...votes.values()].filter(v => v === 'REJECT').length;
    if (acks >= this.quorum) return { status: 'COMMITTED' };
    if (rejects >= this.quorum) return { status: 'REJECTED' };
    return { status: 'PENDING' };
  }
}
```

---

## Ports and Adapters

```typescript
// transport port — engine never knows what's underneath
export interface GameTransportPort {
  send(message: Message): Promise<void>;
  onMessage(handler: (message: Message) => void): () => void;
  onDisconnect(handler: () => void): () => void;
  peers: string[];
}

// pub/sub port — broker never knows game logic
export interface PubSubPort {
  publish(topic: string, payload: object): Promise<void>;
  subscribe(topic: string, handler: (payload: object) => Promise<void>): () => void;
}
```

### Adapters matrix

```
Environment         GameTransport         PubSub
──────────────────────────────────────────────────────
Online              MqttTransport         MqttAdapter (EMQX cluster)
Offline P2P         WebRtcTransport       WebRtcAdapter
Local dev           MqttTransport         MqttAdapter (EMQX single node)
Worker              MqttTransport         MqttAdapter (EMQX shared subscription)
```

Same `MqttAdapter` everywhere — `PUBSUB_URL` env var is the only difference between local and prod.

---

## React Hook

```typescript
export function useGame(gameId: string, playerId: string) {
  const [state, setState] = useState<ChessState>(ChessModule.initialState());
  const [error, setError] = useState<GameError | null>(null);
  const engineRef = useRef<GameEngine<...>>();

  useEffect(() => {
    const transport = new MqttTransport(process.env.PUBSUB_URL);
    engineRef.current = new GameEngine(ChessModule, playerId, transport, setState, setError);

    // rehydrate from event log on mount/reconnect
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

## Worker — Peer, Never Authority

Worker participates in consensus using identical `GameModule` code. It is always a peer, never a ruler.

```typescript
// worker/game-command.handler.ts
mqtt.subscribe('$share/workers/games/+/commands');

mqtt.on('message', async (topic, raw) => {
  const command = JSON.parse(raw.toString());
  const gameId = topic.split('/')[1];

  // fetch minimal state from Aurora
  const events = await db.query(
    'SELECT * FROM game_events WHERE game_id = $1 ORDER BY seq ASC',
    [gameId]
  );
  const state = reduce(GameModule, events.rows);

  // validate using identical GameModule — same code as clients
  const result = GameModule.handleCommand({ state, command });

  // publish vote back to PubSub
  await pubsub.publish(`games/${gameId}/votes`, {
    commandId: command.id,
    from: 'worker',
    vote: result.ok ? 'ACK' : 'REJECT',
    reason: result.ok ? undefined : result.error.message,
  });

  // persist event log if valid — for reconnect recovery
  if (result.ok) {
    await db.query(
      'INSERT INTO game_events (game_id, seq, type, payload) VALUES ($1, $2, $3, $4)',
      [gameId, command.seq, command.payload.type, command.payload]
    );
  }
});
```

Worker roles by game mode:

```
Casual      → not involved (peer only consensus)
Competitive → votes as referee, persists event log
Ranked      → persists event log, flags suspicious patterns async
```

### Reconnect recovery

State is event sourced — reconnect fetches missed events and replays:

```typescript
mqtt.on('disconnect', async () => {
  const missed = await gameApi.getEvents(gameId, { fromSeq: lastKnownSeq });
  setState(reduce(GameModule, missed));
  reconnect();
});
```

---

## Infrastructure Summary

```
ReqRes         App Runner
               HTTP request/response
               Writes to Aurora, publishes invalidations to EMQX
               Scales: round robin replicas — App Runner handles automatically

Worker         App Runner
               MQTT subscriber — referee + reconciliation
               Shared subscriptions — competing consumers
               Writes to Aurora, publishes votes/events/invalidations
               Scales: add instances, EMQX distributes via shared subscriptions

EMQX           4 EC2 nodes globally (c6g.2xlarge, $200/month each)
               Pure MQTT broker — zero application code, config only
               1M connections per node — scales for geography not capacity
               EMQX cluster gossip handles cross-node message routing
               Route 53 latency routing — one URL, clients auto-route to nearest
               Upgrade path: add nodes for new regions, never for more users

Aurora         Serverless v2 — scales to zero (CPU), memory floor ~$10/month
               Event log, game registry, player reputation
               Source of truth for reconnect recovery only
               Clients never write directly — local first

Local dev      docker-compose — one command, full stack
               EMQX single node replaces 4-node cluster
               Same Docker image for ReqRes + Worker
               SERVICE env var boots correct process
```

### Scale at real world benchmarks

```
Scale              Concurrent    Monthly cost
────────────────────────────────────────────────────
Your game (early)  1k            ~$115
Growing            10k           ~$280
Lichess            147k          ~$1,933
Chess.com          500k-1M       ~$6,752
4x Chess.com       4M            architecture unchanged, add EMQX nodes
```

### Local infra (`packages/local`)

Postgres + EMQX run via Docker Compose in the **`@gamezilla/local`** workspace package (infra only — no app containers).

```bash
# From repo root: start postgres + emqx
bun run --filter @gamezilla/local up

# Req res + worker with hot reload (after infra is up)
bun run dev:backend
# or: turbo run dev:req-res dev:worker --parallel
```

Compose file: [`packages/local/docker-compose.yml`](packages/local/docker-compose.yml) — `postgres:16`, `emqx/emqx:5`, ports `5432`, `1883`, `8083`, `18083`.

Run **Req res** and **Worker** on the host with Bun (`packages/app` scripts `dev:req-res` / `dev:worker`): they use `DATABASE_URL` + `PUBSUB_URL` pointing at `127.0.0.1` and the same credentials as compose.

---

## Dependencies

```typescript
import { ulid } from 'ulid';                 // command IDs
import { Result, ok, err } from 'neverthrow'; // Result type
```

No consistent hashing library needed — EMQX handles cross-node routing natively.

Everything else — `GameModule`, `GameEngine`, `ConsensusProtocol`, `GameTransport` — is your code. ~500 lines total. No framework needed.

---

## Key Invariants

1. Events come only from `handleCommand` — never from outside
2. State comes only from `handleEvent` — never mutated directly
3. UI dispatches commands — never events
4. Worker is a peer — never an authority
5. EMQX is a relay — never stateful, never contains business logic
6. ReqRes is HTTP only — never subscribes to MQTT
7. Worker is MQTT only — never handles HTTP
8. `GameModule` is pure — no side effects, no network, no DB
9. Same `GameModule` code runs on all participants — client, Worker, offline
10. Clients never write directly to Aurora — local first, sync via ReqRes
11. No Redis — Worker fetches game state from Aurora directly, not in critical path
12. No consistent hashing — EMQX cluster gossip handles cross-node routing natively
13. EMQX scales for geography not capacity — add nodes for new regions, not more users
