import { Assert } from '@gamezilla/shared/assert'
import { SqlClientImplBunSqlite } from '@gamezilla/shared/sql-client/impl-bun-sqlite'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test'
import { Database } from 'bun:sqlite'
import { TicTacToeModule } from '../__fixtures__/tic-tac-toe.module'
import { InMemoryEventLog, recoverFromEventLog } from '../event-log'
import { MqttEventLog, type MqttPublisher } from '../event-log-mqtt'
import { SqliteEventLog } from '../event-log-sqlite'
import { PeerStore } from '../peer-store'
import { ServerAuthority } from '../server-authority'
import { InMemoryBus, InMemoryTransport } from '../transport'
import type { Command, Event, State } from '../types'
import { TestCrashHandler } from './test-crash-handler'

let disposeCrashHandler: () => void
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler())
})
afterAll(() => disposeCrashHandler())

function board(state: State): Array<null | string> {
  return state['board'] as Array<null | string>
}

// ─── InMemoryEventLog ────────────────────────────────────────────────

describe('InMemoryEventLog', () => {
  it('append and load in order', async () => {
    const log = new InMemoryEventLog()
    const cmd: Command = {
      id: 'cmd-1',
      seq: 1,
      peerId: 'p1',
      message: { type: 'MOVE', payload: {} },
    }
    const events: Event[] = [{ type: 'MOVED', payload: {} }]

    await log.append('game-1', { kind: 'command', command: cmd })
    await log.append('game-1', {
      kind: 'committed',
      commandId: 'cmd-1',
      events,
    })

    const entries = await log.load('game-1')
    expect(entries).toHaveLength(2)
    expect(entries[0]!.kind).toBe('command')
    expect(entries[1]!.kind).toBe('committed')
  })

  it('isolates games', async () => {
    const log = new InMemoryEventLog()
    await log.append('game-a', {
      kind: 'committed',
      commandId: 'c1',
      events: [{ type: 'A', payload: {} }],
    })
    await log.append('game-b', {
      kind: 'committed',
      commandId: 'c2',
      events: [{ type: 'B', payload: {} }],
    })

    expect(await log.load('game-a')).toHaveLength(1)
    expect(await log.load('game-b')).toHaveLength(1)
    expect(await log.load('game-c')).toHaveLength(0)
  })

  it('load returns copies', async () => {
    const log = new InMemoryEventLog()
    await log.append('g', {
      kind: 'committed',
      commandId: 'c1',
      events: [],
    })
    const a = await log.load('g')
    const b = await log.load('g')
    expect(a).not.toBe(b)
  })
})

// ─── recoverFromEventLog ─────────────────────────────────────────────

describe('recoverFromEventLog', () => {
  it('replays committed events and identifies unresolved commands', async () => {
    const log = new InMemoryEventLog()

    const resolvedCmd: Command = {
      id: 'cmd-resolved',
      seq: 1,
      peerId: 'p1',
      message: { type: 'MOVE', payload: {} },
    }
    const unresolvedCmd: Command = {
      id: 'cmd-unresolved',
      seq: 2,
      peerId: 'p1',
      message: { type: 'MOVE', payload: {} },
    }

    await log.append('game-1', { kind: 'command', command: resolvedCmd })
    await log.append('game-1', {
      kind: 'committed',
      commandId: 'cmd-resolved',
      events: [{ type: 'PIECE_MOVED', payload: { cell: 0 } }],
    })
    await log.append('game-1', { kind: 'command', command: unresolvedCmd })

    let rehydratedEvents: Event[] = []
    const unresolved: Command[] = []

    const mockStore = {
      rehydrate(events: Event[]) {
        rehydratedEvents = events
      },
      dispatch() {},
      dispatchOptimistic() {},
      subscribe() {
        return () => {}
      },
      getState() {
        return {}
      },
      getCommittedState() {
        return {}
      },
      getCommittedEvents() {
        return []
      },
      requestSync() {},
      destroy() {},
    }

    await recoverFromEventLog(log, 'game-1', mockStore, (cmd) =>
      unresolved.push(cmd),
    )

    expect(rehydratedEvents).toHaveLength(1)
    expect(rehydratedEvents[0]!.type).toBe('PIECE_MOVED')
    expect(unresolved).toHaveLength(1)
    expect(unresolved[0]!.id).toBe('cmd-unresolved')
  })

  it('handles rejected commands as resolved', async () => {
    const log = new InMemoryEventLog()

    const cmd: Command = {
      id: 'cmd-rej',
      seq: 1,
      peerId: 'p1',
      message: { type: 'BAD', payload: {} },
    }
    await log.append('g', { kind: 'command', command: cmd })
    await log.append('g', { kind: 'rejected', commandId: 'cmd-rej' })

    const unresolved: Command[] = []
    const mockStore = {
      rehydrate() {},
      dispatch() {},
      dispatchOptimistic() {},
      subscribe() {
        return () => {}
      },
      getState() {
        return {}
      },
      getCommittedState() {
        return {}
      },
      getCommittedEvents() {
        return []
      },
      requestSync() {},
      destroy() {},
    }

    await recoverFromEventLog(log, 'g', mockStore, (cmd) =>
      unresolved.push(cmd),
    )

    expect(unresolved).toHaveLength(0)
  })

  it('works with empty log', async () => {
    const log = new InMemoryEventLog()
    let rehydrated = false
    const mockStore = {
      rehydrate() {
        rehydrated = true
      },
      dispatch() {},
      dispatchOptimistic() {},
      subscribe() {
        return () => {}
      },
      getState() {
        return {}
      },
      getCommittedState() {
        return {}
      },
      getCommittedEvents() {
        return []
      },
      requestSync() {},
      destroy() {},
    }

    await recoverFromEventLog(log, 'no-game', mockStore)
    expect(rehydrated).toBe(true)
  })
})

// ─── SqliteEventLog ──────────────────────────────────────────────────

describe('SqliteEventLog', () => {
  let sqlClient: SqlClientImplBunSqlite
  let eventLog: SqliteEventLog

  beforeEach(async () => {
    sqlClient = new SqlClientImplBunSqlite(new Database(':memory:'))
    await sqlClient.connect()
    eventLog = new SqliteEventLog(sqlClient)
    await eventLog.migrate()
  })

  afterEach(async () => {
    await sqlClient.disconnect()
  })

  it('append and load preserves order', async () => {
    const cmd: Command = {
      id: 'cmd-1',
      seq: 1,
      peerId: 'p1',
      message: { type: 'MOVE', payload: { cell: 4 } },
    }
    await eventLog.append('game-1', { kind: 'command', command: cmd })
    await eventLog.append('game-1', {
      kind: 'committed',
      commandId: 'cmd-1',
      events: [{ type: 'PIECE_MOVED', payload: { cell: 4 } }],
    })
    await eventLog.append('game-1', {
      kind: 'rejected',
      commandId: 'cmd-2',
    })

    const entries = await eventLog.load('game-1')
    expect(entries).toHaveLength(3)
    expect(entries[0]!.kind).toBe('command')
    expect(entries[1]!.kind).toBe('committed')
    expect(entries[2]!.kind).toBe('rejected')
  })

  it('round-trips command data through JSON', async () => {
    const cmd: Command = {
      id: 'cmd-rt',
      seq: 7,
      peerId: 'player-x',
      message: { type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } },
    }
    await eventLog.append('g', { kind: 'command', command: cmd })

    const entries = await eventLog.load('g')
    expect(entries).toHaveLength(1)
    const entry = entries[0]!
    expect(entry.kind).toBe('command')
    if (entry.kind === 'command') {
      expect(entry.command.id).toBe('cmd-rt')
      expect(entry.command.seq).toBe(7)
      expect(entry.command.peerId).toBe('player-x')
      expect(entry.command.message.type).toBe('PLACE_MARK')
    }
  })

  it('round-trips committed events through JSON', async () => {
    const events: Event[] = [
      { type: 'MARK_PLACED', payload: { cell: 0, player: 'X' } },
      { type: 'TURN_CHANGED', payload: { next: 'O' } },
    ]
    await eventLog.append('g', {
      kind: 'committed',
      commandId: 'c1',
      events,
    })

    const entries = await eventLog.load('g')
    expect(entries).toHaveLength(1)
    const entry = entries[0]!
    if (entry.kind === 'committed') {
      expect(entry.events).toHaveLength(2)
      expect(entry.events[0]!.type).toBe('MARK_PLACED')
      expect(entry.events[1]!.type).toBe('TURN_CHANGED')
    }
  })

  it('isolates games', async () => {
    await eventLog.append('a', {
      kind: 'committed',
      commandId: 'c1',
      events: [],
    })
    await eventLog.append('b', {
      kind: 'committed',
      commandId: 'c2',
      events: [],
    })

    expect(await eventLog.load('a')).toHaveLength(1)
    expect(await eventLog.load('b')).toHaveLength(1)
    expect(await eventLog.load('c')).toHaveLength(0)
  })

  it('migrate is idempotent', async () => {
    await eventLog.migrate()
    await eventLog.migrate()

    await eventLog.append('g', {
      kind: 'committed',
      commandId: 'c1',
      events: [],
    })
    expect(await eventLog.load('g')).toHaveLength(1)
  })

  it('seq increments correctly across appends', async () => {
    for (let i = 0; i < 5; i++) {
      await eventLog.append('g', {
        kind: 'committed',
        commandId: `c${i}`,
        events: [{ type: `E${i}`, payload: {} }],
      })
    }
    const entries = await eventLog.load('g')
    expect(entries).toHaveLength(5)
    for (let i = 0; i < 5; i++) {
      const entry = entries[i]!
      if (entry.kind === 'committed') {
        expect(entry.commandId).toBe(`c${i}`)
      }
    }
  })
})

// ─── MqttEventLog ────────────────────────────────────────────────────

describe('MqttEventLog', () => {
  function createMockMqtt(): MqttPublisher & {
    retained: Map<string, string>
  } {
    const handlers = new Map<string, Set<(payload: string) => void>>()
    const retained = new Map<string, string>()

    return {
      retained,
      publish(topic, payload, options) {
        if (options?.retain) {
          retained.set(topic, payload)
        }
        const subs = handlers.get(topic)
        if (subs) {
          for (const handler of subs) handler(payload)
        }
      },
      subscribe(topic, handler) {
        if (!handlers.has(topic)) handlers.set(topic, new Set())
        handlers.get(topic)!.add(handler)

        const retainedPayload = retained.get(topic)
        if (retainedPayload !== undefined) {
          handler(retainedPayload)
        }

        return () => {
          handlers.get(topic)?.delete(handler)
        }
      },
    }
  }

  it('publishes committed events as retained message', async () => {
    const mqtt = createMockMqtt()
    const log = new MqttEventLog(mqtt)

    await log.append('game-1', {
      kind: 'committed',
      commandId: 'c1',
      events: [{ type: 'A', payload: {} }],
    })

    const payload = mqtt.retained.get('games/game-1/events')
    expect(payload).toBeDefined()
    const parsed = JSON.parse(payload!)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].type).toBe('A')
  })

  it('accumulates events across appends', async () => {
    const mqtt = createMockMqtt()
    const log = new MqttEventLog(mqtt)

    await log.append('g', {
      kind: 'committed',
      commandId: 'c1',
      events: [{ type: 'A', payload: {} }],
    })
    await log.append('g', {
      kind: 'committed',
      commandId: 'c2',
      events: [{ type: 'B', payload: {} }],
    })

    const payload = mqtt.retained.get('games/g/events')
    const parsed = JSON.parse(payload!)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].type).toBe('A')
    expect(parsed[1].type).toBe('B')
  })

  it('ignores command and rejected entries', async () => {
    const mqtt = createMockMqtt()
    const log = new MqttEventLog(mqtt)

    await log.append('g', {
      kind: 'command',
      command: {
        id: 'x',
        seq: 1,
        peerId: 'p',
        message: { type: 'M', payload: {} },
      },
    })
    await log.append('g', { kind: 'rejected', commandId: 'x' })

    expect(mqtt.retained.get('games/g/events')).toBeUndefined()
  })

  it('load returns committed entries from retained message', async () => {
    const mqtt = createMockMqtt()
    const log = new MqttEventLog(mqtt)

    await log.append('g', {
      kind: 'committed',
      commandId: 'c1',
      events: [
        { type: 'X', payload: {} },
        { type: 'Y', payload: {} },
      ],
    })

    const entries = await log.load('g')
    expect(entries).toHaveLength(1)
    expect(entries[0]!.kind).toBe('committed')
    if (entries[0]!.kind === 'committed') {
      expect(entries[0]!.events).toHaveLength(2)
    }
  })

  it('load returns empty for unknown game', async () => {
    const mqtt = createMockMqtt()
    const log = new MqttEventLog(mqtt)
    const entries = await log.load('nonexistent')
    expect(entries).toHaveLength(0)
  })

  it('uses custom topic prefix', async () => {
    const mqtt = createMockMqtt()
    const log = new MqttEventLog(mqtt, 'custom')

    await log.append('g', {
      kind: 'committed',
      commandId: 'c1',
      events: [{ type: 'A', payload: {} }],
    })

    expect(mqtt.retained.get('custom/g/events')).toBeDefined()
    expect(mqtt.retained.get('games/g/events')).toBeUndefined()
  })
})

// ─── Integration: PeerStore + EventLog ───────────────────────────────

describe('PeerStore + EventLog integration', () => {
  function setup() {
    const bus = new InMemoryBus()
    const t_x = new InMemoryTransport(bus, 'player-x')
    const t_o = new InMemoryTransport(bus, 'player-o')
    const t_server = new InMemoryTransport(bus, 'server')
    const peers = ['player-x', 'player-o', 'server']

    const log = new InMemoryEventLog()
    const gameId = 'game-1'
    const committed: Array<{ commandId: string; events: Event[] }> = []
    const rejected: string[] = []

    const store_x = new PeerStore(
      TicTacToeModule,
      {
        peerId: 'player-x',
        peers,
        transport: t_x,
        authority: new ServerAuthority({
          peerId: 'player-x',
          serverId: 'server',
        }),
      },
    )
    const store_o = new PeerStore(
      TicTacToeModule,
      {
        peerId: 'player-o',
        peers,
        transport: t_o,
        authority: new ServerAuthority({
          peerId: 'player-o',
          serverId: 'server',
        }),
      },
      {
        onReject(commandId) {
          rejected.push(commandId)
        },
      },
    )
    const store_server = new PeerStore(
      TicTacToeModule,
      {
        peerId: 'server',
        peers,
        transport: t_server,
        authority: new ServerAuthority({
          peerId: 'server',
          serverId: 'server',
        }),
      },
      {
        onCommit(commandId, events) {
          committed.push({ commandId, events })
          void log.append(gameId, { kind: 'committed', commandId, events })
        },
        onReject(commandId) {
          void log.append(gameId, { kind: 'rejected', commandId })
        },
      },
    )

    function destroy() {
      store_x.destroy()
      store_o.destroy()
      store_server.destroy()
      t_x.destroy()
      t_o.destroy()
      t_server.destroy()
      bus.destroy()
    }

    return {
      store_x,
      store_o,
      store_server,
      log,
      gameId,
      committed,
      rejected,
      destroy,
    }
  }

  it('onCommit callback captures all committed events', () => {
    const { store_x, store_o, store_server, committed, destroy } = setup()

    store_x.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    store_o.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 3, player: 'O' },
    })
    store_x.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 1, player: 'X' },
    })

    expect(committed).toHaveLength(3)

    const serverEvents = store_server.getCommittedEvents()
    const loggedEvents = committed.flatMap((c) => c.events)
    expect(loggedEvents).toHaveLength(serverEvents.length)

    destroy()
  })

  it('onReject callback fires for rejected commands', () => {
    const bus = new InMemoryBus()
    const t_x = new InMemoryTransport(bus, 'player-x')
    const t_o = new InMemoryTransport(bus, 'player-o')
    const t_server = new InMemoryTransport(bus, 'server')
    const peers = ['player-x', 'player-o', 'server']
    const rejected: string[] = []

    const _store_x = new PeerStore(TicTacToeModule, {
      peerId: 'player-x',
      peers,
      transport: t_x,
      authority: new ServerAuthority({ peerId: 'player-x', serverId: 'server' }),
    })
    const store_o = new PeerStore(
      TicTacToeModule,
      {
        peerId: 'player-o',
        peers,
        transport: t_o,
        authority: new ServerAuthority({ peerId: 'player-o', serverId: 'server' }),
      },
      { onReject: (id) => rejected.push(id) },
    )
    const _store_server = new PeerStore(TicTacToeModule, {
      peerId: 'server',
      peers,
      transport: t_server,
      authority: new ServerAuthority({ peerId: 'server', serverId: 'server' }),
    })

    // Disconnect player-o so it doesn't see player-x's commit
    t_o.disconnect()

    // Player-x takes cell 0 → server commits, player-o doesn't see it
    _store_x.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    // Player-o has stale state (currentTurn=X, cell 0 empty).
    // It dispatches for cell 0 — local handle succeeds against stale state.
    store_o.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    // Reconnect: outgoing submit reaches server, server sees cell 0 occupied → rejects
    t_o.reconnect()

    expect(rejected.length).toBeGreaterThanOrEqual(1)

    _store_x.destroy()
    store_o.destroy()
    _store_server.destroy()
    t_x.destroy()
    t_o.destroy()
    t_server.destroy()
    bus.destroy()
  })

  it('recovery from event log rebuilds state', async () => {
    const { store_x, store_o, store_server, log, gameId, destroy } = setup()

    store_x.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'X' },
    })
    store_o.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'O' },
    })

    const originalState = store_server.getCommittedState()
    expect(board(originalState)[4]).toBe('X')
    expect(board(originalState)[0]).toBe('O')

    destroy()

    // Create a fresh store and recover from the log
    const bus2 = new InMemoryBus()
    const t_recovery = new InMemoryTransport(bus2, 'server')
    const t_dummy = new InMemoryTransport(bus2, 'dummy')
    const recoveredStore = new PeerStore(
      TicTacToeModule,
      {
        peerId: 'server',
        peers: ['server', 'dummy'],
        transport: t_recovery,
        authority: new ServerAuthority({
          peerId: 'server',
          serverId: 'server',
        }),
      },
    )

    await recoverFromEventLog(log, gameId, recoveredStore)

    const recoveredState = recoveredStore.getCommittedState()
    expect(board(recoveredState)[4]).toBe('X')
    expect(board(recoveredState)[0]).toBe('O')
    expect(recoveredState['currentTurn']).toBe('X')

    recoveredStore.destroy()
    t_recovery.destroy()
    t_dummy.destroy()
    bus2.destroy()
  })
})
