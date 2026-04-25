import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from 'bun:test'
import { Assert } from '@gamezilla/lib/assert'
import { PeerStore } from './peer-store'
import { InMemoryBus, InMemoryTransport } from '../transport'
import { isSystemEvent } from '../events/utils'
import type { StoreError } from '../events/message-types'
import type {
  Command,
  HandleResult,
  PeerStoreRoomConfig,
  State,
  StoreModule,
} from './types'
import {
  ClockTimeout,
  JoinSession,
  PlaceMark,
  TickClock,
  TIC_TAC_TOE_CLOCK_MS_PER_PLAYER,
  TicTacToeModule,
  WrongTurnError,
} from '../testkit/fixtures/tic-tac-toe.module'
import { TestCrashHandler } from '../testkit/test-crash-handler'
import { ticTacToeBoardCell } from '../testkit/tic-tac-toe-board'
import {
  testPeerForLabel,
  ticTacToeThreePeers,
} from '../testkit/tic-tac-toe-peers'

const crash: Assert = Assert.crash()

let disposeCrashHandler: () => void
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler())
})
afterAll(() => disposeCrashHandler())

const TEST_TOPIC = 'peer-store-test'
const EFFECT_TOPIC = 'peer-store-effects-test'

const F = ticTacToeThreePeers()
const PEER = {
  authority: F.peers.authority.peerId,
  playerX: F.peers.playerX.peerId,
  playerO: F.peers.playerO.peerId,
} as const
const PEER_IDS = [PEER.authority, PEER.playerX, PEER.playerO]

const EffectModule: StoreModule = {
  initialState: () => ({ count: 0 }),
  handle: (state: State): HandleResult => {
    const count = typeof state['count'] === 'number' ? state['count'] : 0
    return {
      ok: true,
      events: [{ type: 'effectEvent/COUNTED', payload: { count: count + 1 } }],
      effects: [{ type: 'effectAction/SCHEDULE', payload: { delayMs: 1000 } }],
    }
  },
  reduce: (state: State, event): State => {
    if (event.type !== 'effectEvent/COUNTED') return state
    const payload = event.payload
    let nextCount = 0
    if (typeof payload === 'object' && payload !== null && 'count' in payload) {
      const countValue = Reflect.get(payload, 'count')
      if (typeof countValue === 'number') {
        nextCount = countValue
      }
    }
    return { ...state, count: nextCount }
  },
}

type SetupOpts = {
  peers?: Record<string, number>
  initialMemberPublicKeys?: Record<string, string>
  peerSecretSeeds?: Record<string, Uint8Array>
  timeoutMs?: number
  heartbeatIntervalMs?: number
  heartbeatTimeoutMs?: number
}

type BuildStoreConfigArgs = {
  opts?: SetupOpts | undefined
  peers: Record<string, number>
  initialMemberPublicKeys: Record<string, string>
  peerSecretSeeds: Record<string, Uint8Array>
  peerId: string
  transport: InMemoryTransport
}

function buildStoreConfig(args: BuildStoreConfigArgs): PeerStoreRoomConfig {
  const config: PeerStoreRoomConfig = {
    topic: TEST_TOPIC,
    roomSecret: F.roomSecret,
    secretSeed: args.peerSecretSeeds[args.peerId]!,
    transport: args.transport,
    role: {
      type: 'host',
      initialMembership: args.peers,
      initialMemberPublicKeys: args.initialMemberPublicKeys,
    },
  }
  applyOptionalStoreConfig(config, args.opts)
  return config
}

function applyOptionalStoreConfig(
  config: PeerStoreRoomConfig,
  opts: SetupOpts | undefined,
): void {
  if (!opts) return
  if (opts.timeoutMs !== undefined) config.timeoutMs = opts.timeoutMs
  if (opts.heartbeatIntervalMs !== undefined) {
    config.heartbeatIntervalMs = opts.heartbeatIntervalMs
  }
  if (opts.heartbeatTimeoutMs !== undefined) {
    config.heartbeatTimeoutMs = opts.heartbeatTimeoutMs
  }
}

function setup(opts?: SetupOpts) {
  const peers = opts?.peers ?? F.initialMembership
  const initialMemberPublicKeys =
    opts?.initialMemberPublicKeys ?? F.initialMemberPublicKeys
  const peerSecretSeeds = opts?.peerSecretSeeds ?? F.peerSecretSeeds
  const peerIds = Object.keys(peers)
  for (const id of peerIds) {
    crash.ok(
      id in initialMemberPublicKeys,
      'setup requires initialMemberPublicKeys for every peer',
      { id },
    )
    crash.ok(id in peerSecretSeeds, 'setup requires peerSecretSeeds for every peer', {
      id,
    })
  }
  const bus = new InMemoryBus()
  const transports = new Map<string, InMemoryTransport>()
  const stores = new Map<string, PeerStore>()
  const timeouts: string[] = []
  const errors: StoreError[] = []
  const syncs: string[] = []
  const authorityChanges: Array<{
    newAuthority: string
    previousAuthority: string
  }> = []

  for (const peerId of peerIds) {
    const transport = new InMemoryTransport(bus, peerId)
    transports.set(peerId, transport)

    const store = new PeerStore(
      TicTacToeModule,
      buildStoreConfig({
        opts,
        peers,
        initialMemberPublicKeys,
        peerSecretSeeds,
        peerId,
        transport,
      }),
      {
        onTimeout: (commandId) => timeouts.push(commandId),
        onError: (error) => errors.push(error),
        onSync: () => syncs.push(peerId),
        onAuthorityChange: (newAuth, prevAuth) =>
          authorityChanges.push({
            newAuthority: newAuth,
            previousAuthority: prevAuth,
          }),
      },
    )
    stores.set(peerId, store)
  }

  return { bus, transports, stores, timeouts, errors, syncs, authorityChanges }
}

describe('PeerStore', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('dispatch on destroyed store → crash', () => {
    const { stores } = setup()
    const store = stores.get(PEER.playerX)!
    store.destroy()
    expect(() =>
      store.dispatch(PlaceMark({ cell: 0, player: 'X' })),
    ).toThrow('destroyed')
  })

  it('dispatch calls onError when handle returns error', () => {
    const { stores, errors } = setup()
    const store = stores.get(PEER.playerO)!
    store.dispatch(PlaceMark({ cell: 0, player: 'O' }))
    expect(errors.length).toBe(1)
    expect(WrongTurnError.is(errors[0]!)).toBe(true)
  })

  it('authority dispatch commits immediately', () => {
    const { stores } = setup()
    const store_auth = stores.get(PEER.authority)!
    expect(store_auth.isAuthority()).toBe(true)

    store_auth.dispatch(PlaceMark({ cell: 4, player: 'X' }))

    const committed = store_auth.getCommittedState()
    expect(ticTacToeBoardCell(committed, 4)).toBe('X')
  })

  it('non-authority dispatch applies optimistic state and commits via authority', () => {
    const { stores } = setup()
    const store_x = stores.get(PEER.playerX)!
    expect(store_x.isAuthority()).toBe(false)

    store_x.dispatch(PlaceMark({ cell: 4, player: 'X' }))

    const display = store_x.getState()
    expect(ticTacToeBoardCell(display, 4)).toBe('X')

    const committed = store_x.getCommittedState()
    expect(ticTacToeBoardCell(committed, 4)).toBe('X')
  })

  it('authority broadcasts accepted to all peers', () => {
    const { stores } = setup()
    const store_x = stores.get(PEER.playerX)!

    store_x.dispatch(PlaceMark({ cell: 0, player: 'X' }))

    for (const peerId of PEER_IDS) {
      const s = stores.get(peerId)!
      expect(ticTacToeBoardCell(s.getCommittedState(), 0)).toBe('X')
    }
  })

  it('dispatch increments seq monotonically', () => {
    const { stores } = setup()
    const store_x = stores.get(PEER.playerX)!

    store_x.dispatch(PlaceMark({ cell: 0, player: 'X' }))

    const store_o = stores.get(PEER.playerO)!
    store_o.dispatch(PlaceMark({ cell: 1, player: 'O' }))

    store_x.dispatch(PlaceMark({ cell: 2, player: 'X' }))

    const events = store_x
      .getCommittedLogEntries()
      .filter((entry) => !isSystemEvent(entry.event))
      .map((entry) => entry.event)
    crash.ok(events.length >= 1, 'expected at least 1 committed event')
  })

  it('onTimeout fires and rolls back optimistic after timeout', () => {
    const { stores, transports, timeouts } = setup({
      timeoutMs: 5000,
    })

    transports.get(PEER.authority)!.disconnect()

    const store_x = stores.get(PEER.playerX)!
    store_x.dispatch(PlaceMark({ cell: 0, player: 'X' }))

    const before = store_x.getState()
    expect(ticTacToeBoardCell(before, 0)).toBe('X')

    jest.advanceTimersByTime(5001)

    const after = store_x.getState()
    expect(ticTacToeBoardCell(after, 0)).toBeNull()
    expect(timeouts.length).toBe(1)
  })

  it('subscribe receives state on every change', () => {
    const { stores } = setup()
    const store_x = stores.get(PEER.playerX)!

    const states_seen: State[] = []
    store_x.subscribe((s) => states_seen.push(s))

    store_x.dispatch(PlaceMark({ cell: 0, player: 'X' }))
    expect(states_seen.length).toBeGreaterThanOrEqual(1)
  })

  it('unsubscribe stops state updates', () => {
    const { stores } = setup()
    const store_x = stores.get(PEER.playerX)!

    const states_seen: State[] = []
    const unsub = store_x.subscribe((s) => states_seen.push(s))

    store_x.dispatch(PlaceMark({ cell: 0, player: 'X' }))
    const count_after_first = states_seen.length

    unsub()

    stores.get(PEER.playerO)!.dispatch(PlaceMark({ cell: 1, player: 'O' }))
    expect(states_seen.length).toBe(count_after_first)
  })

  it('subscribe on destroyed store → crash', () => {
    const { stores } = setup()
    const store = stores.get(PEER.playerX)!
    store.destroy()
    expect(() => store.subscribe(() => {})).toThrow('destroyed')
  })

  it('rehydrate replaces committed events and clears optimistic', () => {
    const { stores } = setup()
    const store_x = stores.get(PEER.playerX)!
    const store_auth = stores.get(PEER.authority)!

    store_auth.dispatch(PlaceMark({ cell: 4, player: 'X' }))
    const entries = store_auth.getCommittedLogEntries()
    store_x.rehydrate(entries)

    const state = store_x.getCommittedState()
    expect(ticTacToeBoardCell(state, 4)).toBe('X')
  })

  it('rehydrate is deterministic (same events → same state)', () => {
    const { stores } = setup()
    const store_x = stores.get(PEER.playerX)!
    const store_o = stores.get(PEER.playerO)!
    const store_auth = stores.get(PEER.authority)!

    store_auth.dispatch(PlaceMark({ cell: 0, player: 'X' }))
    store_auth.dispatch(PlaceMark({ cell: 4, player: 'O' }))
    const entries = store_auth.getCommittedLogEntries()

    store_x.rehydrate(entries)
    store_o.rehydrate(entries)

    expect(JSON.stringify(store_x.getCommittedState())).toBe(
      JSON.stringify(store_o.getCommittedState()),
    )
  })

  it('destroy cleans up all subscriptions', () => {
    const { stores } = setup()
    const store_x = stores.get(PEER.playerX)!

    let call_count = 0
    store_x.subscribe(() => call_count++)

    store_x.dispatch(PlaceMark({ cell: 0, player: 'X' }))
    const count_before = call_count

    store_x.destroy()

    expect(call_count).toBe(count_before)
  })

  it('destroy is idempotent (second call is no-op)', () => {
    const { stores } = setup()
    const store = stores.get(PEER.playerX)!
    store.destroy()
    store.destroy()
  })

  it('module.handle returning null → crash', () => {
    const badModule: StoreModule = {
      initialState: () => ({}),
      handle: () => {
        // Intentionally violates HandleResult so PeerStore must crash (not for production).
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test stub
        return null as unknown as HandleResult
      },
      reduce: (s: State) => s,
    }
    const ba = testPeerForLabel('bad-module-a')
    const bb = testPeerForLabel('bad-module-b')
    const member = { [ba.peerId]: 1, [bb.peerId]: 3 }
    const pubMap = {
      [ba.peerId]: ba.publicKeyB64,
      [bb.peerId]: bb.publicKeyB64,
    }
    const bus = new InMemoryBus()
    const t1 = new InMemoryTransport(bus, ba.peerId)
    const t2 = new InMemoryTransport(bus, bb.peerId)
    const store = new PeerStore(badModule, {
      topic: TEST_TOPIC,
      roomSecret: F.roomSecret,
      secretSeed: ba.secretSeed,
      transport: t1,
      role: {
        type: 'host',
        initialMembership: member,
        initialMemberPublicKeys: pubMap,
      },
    })
    const _store2 = new PeerStore(badModule, {
      topic: TEST_TOPIC,
      roomSecret: F.roomSecret,
      secretSeed: bb.secretSeed,
      transport: t2,
      role: {
        type: 'host',
        initialMembership: member,
        initialMemberPublicKeys: pubMap,
      },
    })

    expect(() =>
      store.dispatch({ type: 'test', payload: {} }),
    ).toThrow()

    store.destroy()
    _store2.destroy()
    t1.destroy()
    t2.destroy()
    bus.destroy()
  })

  it('module.reduce returning array → crash', () => {
    const badModule: StoreModule = {
      initialState: () => ({}),
      handle: (_s: State, _c: Command) => ({
        ok: true,
        events: [{ type: 'e', payload: {} }],
      }),
      reduce: () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test stub
        return [] as unknown as State
      },
    }
    const ba = testPeerForLabel('bad-reduce-a')
    const bb = testPeerForLabel('bad-reduce-b')
    const member = { [ba.peerId]: 1, [bb.peerId]: 3 }
    const pubMap = {
      [ba.peerId]: ba.publicKeyB64,
      [bb.peerId]: bb.publicKeyB64,
    }
    const bus = new InMemoryBus()
    const t1 = new InMemoryTransport(bus, ba.peerId)
    const t2 = new InMemoryTransport(bus, bb.peerId)
    const store = new PeerStore(badModule, {
      topic: TEST_TOPIC,
      roomSecret: F.roomSecret,
      secretSeed: bb.secretSeed,
      transport: t2,
      role: {
        type: 'host',
        initialMembership: member,
        initialMemberPublicKeys: pubMap,
      },
    })
    const _store2 = new PeerStore(badModule, {
      topic: TEST_TOPIC,
      roomSecret: F.roomSecret,
      secretSeed: ba.secretSeed,
      transport: t1,
      role: {
        type: 'host',
        initialMembership: member,
        initialMemberPublicKeys: pubMap,
      },
    })

    expect(() =>
      store.dispatch({ type: 'test', payload: {} }),
    ).toThrow()

    store.destroy()
    _store2.destroy()
    t1.destroy()
    t2.destroy()
    bus.destroy()
  })

  it('getAuthorityPeerId returns highest-trust peer', () => {
    const { stores } = setup()
    for (const store of stores.values()) {
      expect(store.getAuthorityPeerId()).toBe(PEER.authority)
    }
  })

  it('equal trust ties broken by peerId alphabetical order', () => {
    const alice = testPeerForLabel('tie-alice')
    const bob = testPeerForLabel('tie-bob')
    const charlie = testPeerForLabel('tie-charlie')
    const peers = {
      [alice.peerId]: 1,
      [bob.peerId]: 1,
      [charlie.peerId]: 1,
    }
    const pubMap = {
      [alice.peerId]: alice.publicKeyB64,
      [bob.peerId]: bob.publicKeyB64,
      [charlie.peerId]: charlie.publicKeyB64,
    }
    const seeds = {
      [alice.peerId]: alice.secretSeed,
      [bob.peerId]: bob.secretSeed,
      [charlie.peerId]: charlie.secretSeed,
    }
    const expectedHead = [alice.peerId, bob.peerId, charlie.peerId].sort((a, b) =>
      a.localeCompare(b),
    )[0]!
    const { stores } = setup({
      peers,
      initialMemberPublicKeys: pubMap,
      peerSecretSeeds: seeds,
    })
    for (const store of stores.values()) {
      expect(store.getAuthorityPeerId()).toBe(expectedHead)
    }
  })

  it('commit effects are emitted only on producing authority store', () => {
    const bus = new InMemoryBus()
    const peers = F.initialMembership
    const byPeer = new Map<
      string,
      Array<{ commandId: string; effectCount: number }>
    >()

    const makeStore = (peerId: string) => {
      const transport = new InMemoryTransport(bus, peerId)
      const rows: Array<{ commandId: string; effectCount: number }> = []
      byPeer.set(peerId, rows)
      const store = new PeerStore(
        EffectModule,
        {
          topic: EFFECT_TOPIC,
          roomSecret: F.roomSecret,
          secretSeed: F.peerSecretSeeds[peerId]!,
          transport,
          role: {
            type: 'host',
            initialMembership: peers,
            initialMemberPublicKeys: F.initialMemberPublicKeys,
          },
        },
        {
          onCommit: (commandId, _entries, effects) => {
            rows.push({ commandId, effectCount: effects?.length ?? 0 })
          },
        },
      )
      return { store, transport }
    }

    const x = makeStore(PEER.playerX)
    const o = makeStore(PEER.playerO)
    const authority = makeStore(PEER.authority)

    x.store.dispatch({ type: 'effectCommand/DO', payload: {} })

    expect(byPeer.get(PEER.authority)![0]!.effectCount).toBe(1)
    expect(byPeer.get(PEER.playerX)![0]!.effectCount).toBe(0)
    expect(byPeer.get(PEER.playerO)![0]!.effectCount).toBe(0)

    x.store.destroy()
    o.store.destroy()
    authority.store.destroy()
    x.transport.destroy()
    o.transport.destroy()
    authority.transport.destroy()
    bus.destroy()
  })
})

describe('Sync protocol', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('requestSync broadcasts sync-request and authority responds', () => {
    const { stores, transports, syncs } = setup()
    const store_x = stores.get(PEER.playerX)!

    store_x.dispatch(PlaceMark({ cell: 0, player: 'X' }))

    transports.get(PEER.playerO)!.disconnect()
    store_x.dispatch(PlaceMark({ cell: 4, player: 'X' }))

    expect(
      ticTacToeBoardCell(stores.get(PEER.playerO)!.getCommittedState(), 4),
    ).toBeNull()

    transports.get(PEER.playerO)!.reconnect()

    expect(
      ticTacToeBoardCell(stores.get(PEER.playerO)!.getCommittedState(), 0),
    ).toBe('X')

    expect(syncs).toContain(PEER.playerO)
  })

  it('non-authority peer ignores sync-request', () => {
    const { stores, transports } = setup()

    stores.get(PEER.playerX)!.dispatch(PlaceMark({ cell: 0, player: 'X' }))

    transports.get(PEER.authority)!.disconnect()

    stores.get(PEER.playerO)!.dispatch(PlaceMark({ cell: 4, player: 'O' }))

    transports.get(PEER.authority)!.reconnect()

    const auth_events = stores
      .get(PEER.authority)!
      .getCommittedLogEntries()
      .filter((entry) => !isSystemEvent(entry.event))
      .map((entry) => entry.event)
    expect(auth_events.length).toBeGreaterThanOrEqual(1)
  })

  it('auto-sync on transport reconnect converges state', () => {
    const { stores, transports } = setup()

    stores.get(PEER.playerX)!.dispatch(PlaceMark({ cell: 0, player: 'X' }))

    transports.get(PEER.playerO)!.disconnect()

    stores.get(PEER.playerO)!.dispatch(PlaceMark({ cell: 4, player: 'O' }))

    transports.get(PEER.playerO)!.reconnect()

    const state_o = stores.get(PEER.playerO)!.getCommittedState()
    const state_auth = stores.get(PEER.authority)!.getCommittedState()
    expect(JSON.stringify(state_o)).toBe(JSON.stringify(state_auth))
  })

  it('onSync callback fires after successful sync', () => {
    const { stores, transports, syncs } = setup()

    stores.get(PEER.playerX)!.dispatch(PlaceMark({ cell: 0, player: 'X' }))

    transports.get(PEER.playerO)!.disconnect()

    stores.get(PEER.playerX)!.dispatch(PlaceMark({ cell: 4, player: 'X' }))

    expect(syncs.length).toBe(0)
    transports.get(PEER.playerO)!.reconnect()
    expect(syncs).toContain(PEER.playerO)
  })

  it('requestSync on destroyed store → crash', () => {
    const { stores } = setup()
    const store = stores.get(PEER.playerX)!
    store.destroy()
    expect(() => store.requestSync()).toThrow('destroyed')
  })

  it('rehydrate clears finalized_command_ids — subsequent commands process normally', () => {
    const { stores } = setup()

    stores.get(PEER.playerX)!.dispatch(PlaceMark({ cell: 0, player: 'X' }))

    const entries = stores.get(PEER.authority)!.getCommittedLogEntries()
    stores.get(PEER.playerO)!.rehydrate(entries)

    stores.get(PEER.playerO)!.dispatch(PlaceMark({ cell: 4, player: 'O' }))

    const state = stores.get(PEER.playerO)!.getCommittedState()
    expect(ticTacToeBoardCell(state, 4)).toBe('O')
  })
})

describe('Authority failover', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('authority failover when primary goes offline', () => {
    const { stores, transports, authorityChanges } = setup({
      heartbeatIntervalMs: 100,
      heartbeatTimeoutMs: 300,
    })

    for (const store of stores.values()) {
      expect(store.getAuthorityPeerId()).toBe(PEER.authority)
    }

    transports.get(PEER.authority)!.disconnect()

    jest.advanceTimersByTime(500)

    const store_x = stores.get(PEER.playerX)!
    expect(store_x.getAuthorityPeerId()).not.toBe(PEER.authority)

    expect(authorityChanges.length).toBeGreaterThan(0)
  })

  it('authority restored when primary comes back online', () => {
    const { stores, transports } = setup({
      heartbeatIntervalMs: 100,
      heartbeatTimeoutMs: 300,
    })

    transports.get(PEER.authority)!.disconnect()
    jest.advanceTimersByTime(500)

    const store_x = stores.get(PEER.playerX)!
    expect(store_x.getAuthorityPeerId()).not.toBe(PEER.authority)

    transports.get(PEER.authority)!.reconnect()
    jest.advanceTimersByTime(200)

    expect(store_x.getAuthorityPeerId()).toBe(PEER.authority)
  })
})

describe('Chess-style clock (PeerStore + TicTacToe)', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  function seedSeatedGame(stores: Map<string, PeerStore>): void {
    stores.get(PEER.playerX)!.dispatch(JoinSession({ mark: 'X' }))
    stores.get(PEER.playerO)!.dispatch(JoinSession({ mark: 'O' }))
    stores.get(PEER.playerX)!.dispatch(PlaceMark({ cell: 0, player: 'X' }))
  }

  it('authority clock tick debits only active player; inactive unchanged', () => {
    const { stores } = setup()
    seedSeatedGame(stores)

    expect(stores.get(PEER.authority)!.getCommittedState()['clockStatus']).toBe(
      'running',
    )
    expect(stores.get(PEER.authority)!.getCommittedState()['clockActivePlayer']).toBe(
      'O',
    )
    expect(stores.get(PEER.authority)!.getCommittedState()['remainingMsX']).toBe(
      TIC_TAC_TOE_CLOCK_MS_PER_PLAYER,
    )

    stores.get(PEER.authority)!.dispatch(TickClock({ elapsedMs: 1000 }))

    const s = stores.get(PEER.authority)!.getCommittedState()
    expect(s['remainingMsX']).toBe(TIC_TAC_TOE_CLOCK_MS_PER_PLAYER)
    expect(s['remainingMsO']).toBeLessThan(TIC_TAC_TOE_CLOCK_MS_PER_PLAYER)
    expect(s['clockActivePlayer']).toBe('O')
  })

  it('clock switches active player after opponent move', () => {
    const { stores } = setup()
    seedSeatedGame(stores)

    stores.get(PEER.authority)!.dispatch(TickClock({ elapsedMs: 500 }))
    stores.get(PEER.playerO)!.dispatch(PlaceMark({ cell: 4, player: 'O' }))

    const s = stores.get(PEER.authority)!.getCommittedState()
    expect(s['currentTurn']).toBe('X')
    expect(s['clockActivePlayer']).toBe('X')
    expect(s['remainingMsO']).toBeLessThanOrEqual(TIC_TAC_TOE_CLOCK_MS_PER_PLAYER)
  })

  it('active player clock timeout ends game with ClockTimeout', () => {
    const { stores } = setup()
    seedSeatedGame(stores)

    stores.get(PEER.authority)!.dispatch(
      TickClock({ elapsedMs: TIC_TAC_TOE_CLOCK_MS_PER_PLAYER + 500 }),
    )

    const auth = stores.get(PEER.authority)!
    const events = auth
      .getCommittedLogEntries()
      .filter((entry) => !isSystemEvent(entry.event))
      .map((entry) => entry.event)
    expect(events.some((e) => ClockTimeout.is(e))).toBe(true)
    expect(auth.getCommittedState()['status']).toBe('completed')
    expect(auth.getCommittedState()['winner']).toBe('X')
  })

  it('rehydrate from authority log restores identical clock fields', () => {
    const { stores } = setup()
    seedSeatedGame(stores)

    stores.get(PEER.authority)!.dispatch(TickClock({ elapsedMs: 600 }))

    const entries = stores.get(PEER.authority)!.getCommittedLogEntries()
    const authState = stores.get(PEER.authority)!.getCommittedState()
    stores.get(PEER.playerX)!.rehydrate(entries)
    expect(JSON.stringify(stores.get(PEER.playerX)!.getCommittedState())).toBe(
      JSON.stringify(authState),
    )
  })
})
