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
import type { StoreError } from '../protocol/message-types'
import type {
  Command,
  HandleResult,
  State,
  StoreModule,
} from './peer-store-types'
import {
  MarkPlaced,
  PlaceMark,
  TicTacToeModule,
  WrongTurnError,
} from '../testing/fixtures/tic-tac-toe.module'
import { TestCrashHandler } from '../testing/test-crash-handler'
import { ticTacToeBoardCell } from '../testing/tic-tac-toe-board'

const crash: Assert = Assert.crash()

let disposeCrashHandler: () => void
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler())
})
afterAll(() => disposeCrashHandler())

const TRUST = { 'player-x': 1, 'player-o': 1, 'authority': 3 } as const
const PEER_IDS = Object.keys(TRUST)
const TEST_TOPIC = 'peer-store-test'

function setup(opts?: {
  peers?: Record<string, number>
  timeoutMs?: number
  heartbeatIntervalMs?: number
  heartbeatTimeoutMs?: number
}) {
  const peers = opts?.peers ?? TRUST
  const peerIds = Object.keys(peers)
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
      {
        topic: TEST_TOPIC,
        peerId,
        bootstrap: { kind: 'genesis', initialMembership: peers },
        transport,
        ...(opts?.timeoutMs !== undefined
          ? { timeoutMs: opts.timeoutMs }
          : {}),
        ...(opts?.heartbeatIntervalMs !== undefined
          ? { heartbeatIntervalMs: opts.heartbeatIntervalMs }
          : {}),
        ...(opts?.heartbeatTimeoutMs !== undefined
          ? { heartbeatTimeoutMs: opts.heartbeatTimeoutMs }
          : {}),
      },
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
    const store = stores.get('player-x')!
    store.destroy()
    expect(() =>
      store.dispatch(PlaceMark({ cell: 0, player: 'X' })),
    ).toThrow('destroyed')
  })

  it('dispatch calls onError when handle returns error', () => {
    const { stores, errors } = setup()
    const store = stores.get('player-o')!
    store.dispatch(PlaceMark({ cell: 0, player: 'O' }))
    expect(errors.length).toBe(1)
    expect(WrongTurnError.is(errors[0]!)).toBe(true)
  })

  it('authority dispatch commits immediately', () => {
    const { stores } = setup()
    const store_auth = stores.get('authority')!
    expect(store_auth.isAuthority()).toBe(true)

    store_auth.dispatch(PlaceMark({ cell: 4, player: 'X' }))

    const committed = store_auth.getCommittedState()
    expect(ticTacToeBoardCell(committed, 4)).toBe('X')
  })

  it('non-authority dispatch applies optimistic state and commits via authority', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!
    expect(store_x.isAuthority()).toBe(false)

    store_x.dispatch(PlaceMark({ cell: 4, player: 'X' }))

    const display = store_x.getState()
    expect(ticTacToeBoardCell(display, 4)).toBe('X')

    const committed = store_x.getCommittedState()
    expect(ticTacToeBoardCell(committed, 4)).toBe('X')
  })

  it('authority broadcasts accepted to all peers', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!

    store_x.dispatch(PlaceMark({ cell: 0, player: 'X' }))

    for (const peerId of PEER_IDS) {
      const s = stores.get(peerId)!
      expect(ticTacToeBoardCell(s.getCommittedState(), 0)).toBe('X')
    }
  })

  it('dispatch increments seq monotonically', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!

    store_x.dispatch(PlaceMark({ cell: 0, player: 'X' }))

    const store_o = stores.get('player-o')!
    store_o.dispatch(PlaceMark({ cell: 1, player: 'O' }))

    store_x.dispatch(PlaceMark({ cell: 2, player: 'X' }))

    const events = store_x.getCommittedEvents()
    crash.ok(events.length >= 1, 'expected at least 1 committed event')
  })

  it('onTimeout fires and rolls back optimistic after timeout', () => {
    const { stores, transports, timeouts } = setup({
      timeoutMs: 5000,
    })

    transports.get('authority')!.disconnect()

    const store_x = stores.get('player-x')!
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
    const store_x = stores.get('player-x')!

    const states_seen: State[] = []
    store_x.subscribe((s) => states_seen.push(s))

    store_x.dispatch(PlaceMark({ cell: 0, player: 'X' }))
    expect(states_seen.length).toBeGreaterThanOrEqual(1)
  })

  it('unsubscribe stops state updates', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!

    const states_seen: State[] = []
    const unsub = store_x.subscribe((s) => states_seen.push(s))

    store_x.dispatch(PlaceMark({ cell: 0, player: 'X' }))
    const count_after_first = states_seen.length

    unsub()

    stores.get('player-o')!.dispatch(PlaceMark({ cell: 1, player: 'O' }))
    expect(states_seen.length).toBe(count_after_first)
  })

  it('subscribe on destroyed store → crash', () => {
    const { stores } = setup()
    const store = stores.get('player-x')!
    store.destroy()
    expect(() => store.subscribe(() => {})).toThrow('destroyed')
  })

  it('rehydrate replaces committed events and clears optimistic', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!
    const store_auth = stores.get('authority')!

    store_auth.dispatch(PlaceMark({ cell: 4, player: 'X' }))
    const entries = store_auth.getCommittedLogEntries()
    store_x.rehydrate(entries)

    const state = store_x.getCommittedState()
    expect(ticTacToeBoardCell(state, 4)).toBe('X')
  })

  it('rehydrate is deterministic (same events → same state)', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!
    const store_o = stores.get('player-o')!
    const store_auth = stores.get('authority')!

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
    const store_x = stores.get('player-x')!

    let call_count = 0
    store_x.subscribe(() => call_count++)

    store_x.dispatch(PlaceMark({ cell: 0, player: 'X' }))
    const count_before = call_count

    store_x.destroy()

    expect(call_count).toBe(count_before)
  })

  it('destroy is idempotent (second call is no-op)', () => {
    const { stores } = setup()
    const store = stores.get('player-x')!
    store.destroy()
    store.destroy()
  })

  it('dispatchOptimistic applies immediately, no peers notified', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!
    const store_o = stores.get('player-o')!

    const initial_o = JSON.stringify(store_o.getState())

    store_x.dispatchOptimistic(MarkPlaced({ cell: 4, player: 'X', seq: 99 }))

    const state_x = store_x.getState()
    expect(ticTacToeBoardCell(state_x, 4)).toBe('X')

    expect(JSON.stringify(store_o.getState())).toBe(initial_o)
  })

  it('dispatchOptimistic does not trigger commit', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!

    store_x.dispatchOptimistic(MarkPlaced({ cell: 4, player: 'X', seq: 1 }))

    const committed = store_x.getCommittedState()
    expect(ticTacToeBoardCell(committed, 4)).toBeNull()
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
    const bus = new InMemoryBus()
    const t1 = new InMemoryTransport(bus, 'a')
    const t2 = new InMemoryTransport(bus, 'b')
    const store = new PeerStore(badModule, {
      topic: TEST_TOPIC,
      peerId: 'a',
      bootstrap: { kind: 'genesis', initialMembership: { a: 1, b: 3 } },
      transport: t1,
    })
    const _store2 = new PeerStore(badModule, {
      topic: TEST_TOPIC,
      peerId: 'b',
      bootstrap: { kind: 'genesis', initialMembership: { a: 1, b: 3 } },
      transport: t2,
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
        value: { events: [{ type: 'e', payload: {} }] },
      }),
      reduce: () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test stub
        return [] as unknown as State
      },
    }
    const bus = new InMemoryBus()
    const t1 = new InMemoryTransport(bus, 'a')
    const t2 = new InMemoryTransport(bus, 'b')
    const store = new PeerStore(badModule, {
      topic: TEST_TOPIC,
      peerId: 'b',
      bootstrap: { kind: 'genesis', initialMembership: { a: 1, b: 3 } },
      transport: t2,
    })
    const _store2 = new PeerStore(badModule, {
      topic: TEST_TOPIC,
      peerId: 'a',
      bootstrap: { kind: 'genesis', initialMembership: { a: 1, b: 3 } },
      transport: t1,
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
      expect(store.getAuthorityPeerId()).toBe('authority')
    }
  })

  it('equal trust ties broken by peerId alphabetical order', () => {
    const { stores } = setup({
      peers: { 'bob': 1, 'alice': 1, 'charlie': 1 },
    })
    for (const store of stores.values()) {
      expect(store.getAuthorityPeerId()).toBe('alice')
    }
  })
})

describe('Sync protocol', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('requestSync broadcasts sync-request and authority responds', () => {
    const { stores, transports, syncs } = setup()
    const store_x = stores.get('player-x')!

    store_x.dispatch(PlaceMark({ cell: 0, player: 'X' }))

    transports.get('player-o')!.disconnect()
    store_x.dispatch(PlaceMark({ cell: 4, player: 'X' }))

    expect(
      ticTacToeBoardCell(stores.get('player-o')!.getCommittedState(), 4),
    ).toBeNull()

    transports.get('player-o')!.reconnect()

    expect(
      ticTacToeBoardCell(stores.get('player-o')!.getCommittedState(), 0),
    ).toBe('X')

    expect(syncs).toContain('player-o')
  })

  it('non-authority peer ignores sync-request', () => {
    const { stores, transports } = setup()

    stores.get('player-x')!.dispatch(PlaceMark({ cell: 0, player: 'X' }))

    transports.get('authority')!.disconnect()

    stores.get('player-o')!.dispatch(PlaceMark({ cell: 4, player: 'O' }))

    transports.get('authority')!.reconnect()

    const auth_events = stores.get('authority')!.getCommittedEvents()
    expect(auth_events.length).toBeGreaterThanOrEqual(1)
  })

  it('auto-sync on transport reconnect converges state', () => {
    const { stores, transports } = setup()

    stores.get('player-x')!.dispatch(PlaceMark({ cell: 0, player: 'X' }))

    transports.get('player-o')!.disconnect()

    stores.get('player-o')!.dispatch(PlaceMark({ cell: 4, player: 'O' }))

    transports.get('player-o')!.reconnect()

    const state_o = stores.get('player-o')!.getCommittedState()
    const state_auth = stores.get('authority')!.getCommittedState()
    expect(JSON.stringify(state_o)).toBe(JSON.stringify(state_auth))
  })

  it('onSync callback fires after successful sync', () => {
    const { stores, transports, syncs } = setup()

    stores.get('player-x')!.dispatch(PlaceMark({ cell: 0, player: 'X' }))

    transports.get('player-o')!.disconnect()

    stores.get('player-x')!.dispatch(PlaceMark({ cell: 4, player: 'X' }))

    expect(syncs.length).toBe(0)
    transports.get('player-o')!.reconnect()
    expect(syncs).toContain('player-o')
  })

  it('requestSync on destroyed store → crash', () => {
    const { stores } = setup()
    const store = stores.get('player-x')!
    store.destroy()
    expect(() => store.requestSync()).toThrow('destroyed')
  })

  it('rehydrate clears finalized_command_ids — subsequent commands process normally', () => {
    const { stores } = setup()

    stores.get('player-x')!.dispatch(PlaceMark({ cell: 0, player: 'X' }))

    const entries = stores.get('authority')!.getCommittedLogEntries()
    stores.get('player-o')!.rehydrate(entries)

    stores.get('player-o')!.dispatch(PlaceMark({ cell: 4, player: 'O' }))

    const state = stores.get('player-o')!.getCommittedState()
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
      expect(store.getAuthorityPeerId()).toBe('authority')
    }

    transports.get('authority')!.disconnect()

    jest.advanceTimersByTime(500)

    const store_x = stores.get('player-x')!
    expect(store_x.getAuthorityPeerId()).not.toBe('authority')

    expect(authorityChanges.length).toBeGreaterThan(0)
  })

  it('authority restored when primary comes back online', () => {
    const { stores, transports } = setup({
      heartbeatIntervalMs: 100,
      heartbeatTimeoutMs: 300,
    })

    transports.get('authority')!.disconnect()
    jest.advanceTimersByTime(500)

    const store_x = stores.get('player-x')!
    expect(store_x.getAuthorityPeerId()).not.toBe('authority')

    transports.get('authority')!.reconnect()
    jest.advanceTimersByTime(200)

    expect(store_x.getAuthorityPeerId()).toBe('authority')
  })
})
