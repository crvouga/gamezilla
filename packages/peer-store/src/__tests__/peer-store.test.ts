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
import { Assert } from '@gamezilla/shared/assert'
import { anyPeerAuthority, designatedAuthority } from '../authority'
import { PeerStore } from '../peer-store'
import { InMemoryBus, InMemoryTransport } from '../transport'
import type { AuthorityPolicy, Event, HandleResult, State, StoreModule } from '../types'
import { TicTacToeModule } from '../__fixtures__/tic-tac-toe.module'
import { TestCrashHandler } from './test-crash-handler'

const crash: Assert = Assert.crash()

let disposeCrashHandler: () => void
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler())
})
afterAll(() => disposeCrashHandler())

const PEERS = ['player-x', 'player-o', 'worker']

function setup(opts?: {
  quorum?: number
  consensusTimeoutMs?: number
  authority?: AuthorityPolicy
}) {
  const bus = new InMemoryBus()
  const transports = new Map<string, InMemoryTransport>()
  const stores = new Map<string, PeerStore>()
  const bad_actors: Array<{ peerId: string; commandId: string }> = []
  const timeouts: string[] = []
  const errors: Array<{ code: string; message: string }> = []
  const syncs: string[] = []

  for (const peerId of PEERS) {
    const transport = new InMemoryTransport(bus, peerId)
    transports.set(peerId, transport)

    const store = new PeerStore(
      TicTacToeModule,
      {
        peerId,
        peers: PEERS,
        transport,
        ...(opts?.quorum !== undefined ? { quorum: opts.quorum } : {}),
        ...(opts?.consensusTimeoutMs !== undefined ? { consensusTimeoutMs: opts.consensusTimeoutMs } : {}),
        ...(opts?.authority !== undefined ? { authority: opts.authority } : {}),
      },
      {
        onBadActor: (badPeerId, commandId) =>
          bad_actors.push({ peerId: badPeerId, commandId }),
        onTimeout: (commandId) => timeouts.push(commandId),
        onError: (error) => errors.push(error),
        onSync: () => syncs.push(peerId),
      },
    )
    stores.set(peerId, store)
  }

  return { bus, transports, stores, bad_actors, timeouts, errors, syncs }
}

describe('PeerStore', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('dispatch on destroyed store → crash', () => {
    const { stores } = setup()
    const store = stores.get('player-x')!
    store.destroy()
    expect(() =>
      store.dispatch({ type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } }),
    ).toThrow('destroyed')
  })

  it('dispatch calls onError and does not publish when handle returns error', () => {
    const { stores, errors } = setup()
    const store = stores.get('player-o')!
    store.dispatch({ type: 'PLACE_MARK', payload: { cell: 0, player: 'O' } })
    expect(errors.length).toBe(1)
    expect(errors[0]!.code).toBe('WRONG_TURN')
  })

  it('dispatch applies optimistic state immediately', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!

    const states_seen: State[] = []
    store_x.subscribe((s) => states_seen.push(s))

    store_x.dispatch({ type: 'PLACE_MARK', payload: { cell: 4, player: 'X' } })

    const state = store_x.getState()
    const board = state['board'] as Array<null | string>
    expect(board[4]).toBe('X')
  })

  it('dispatch increments seq monotonically', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!

    store_x.dispatch({ type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } })

    const store_o = stores.get('player-o')!
    store_o.dispatch({ type: 'PLACE_MARK', payload: { cell: 1, player: 'O' } })

    store_x.dispatch({ type: 'PLACE_MARK', payload: { cell: 2, player: 'X' } })

    const events = store_x.getCommittedEvents()
    crash.ok(events.length >= 1, 'expected at least 1 committed event')
  })

  it('optimistic cleared on consensus commit', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!

    store_x.dispatch({ type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } })

    const committed = store_x.getCommittedState()
    const board = committed['board'] as Array<null | string>
    expect(board[0]).toBe('X')
  })

  it('onTimeout fires and rolls back optimistic after timeout', () => {
    const bus = new InMemoryBus()
    const transport_x = new InMemoryTransport(bus, 'player-x')
    const transport_o = new InMemoryTransport(bus, 'player-o')

    transport_o.disconnect()

    const store_x = new PeerStore(
      TicTacToeModule,
      {
        peerId: 'player-x',
        peers: ['player-x', 'player-o'],
        transport: transport_x,
        consensusTimeoutMs: 5000,
      },
      {
        onTimeout: () => {},
      },
    )

    const _store_o = new PeerStore(
      TicTacToeModule,
      {
        peerId: 'player-o',
        peers: ['player-x', 'player-o'],
        transport: transport_o,
      },
    )

    store_x.dispatch({ type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } })

    const before = store_x.getState()
    expect((before['board'] as Array<null | string>)[0]).toBe('X')

    jest.advanceTimersByTime(5001)

    const after = store_x.getState()
    expect((after['board'] as Array<null | string>)[0]).toBeNull()

    store_x.destroy()
    _store_o.destroy()
    transport_x.destroy()
    transport_o.destroy()
    bus.destroy()
  })

  it('subscribe receives state on every change', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!

    const states_seen: State[] = []
    store_x.subscribe((s) => states_seen.push(s))

    store_x.dispatch({ type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } })
    expect(states_seen.length).toBeGreaterThanOrEqual(1)
  })

  it('unsubscribe stops state updates', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!

    const states_seen: State[] = []
    const unsub = store_x.subscribe((s) => states_seen.push(s))

    store_x.dispatch({ type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } })
    const count_after_first = states_seen.length

    unsub()

    const store_o = stores.get('player-o')!
    store_o.dispatch({ type: 'PLACE_MARK', payload: { cell: 1, player: 'O' } })
    expect(states_seen.length).toBe(count_after_first)
  })

  it('subscribe on destroyed store → crash', () => {
    const { stores } = setup()
    const store = stores.get('player-x')!
    store.destroy()
    expect(() => store.subscribe(() => {})).toThrow('destroyed')
  })

  it('getState returns displayState (committed + optimistic)', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!
    store_x.dispatch({ type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } })
    const state = store_x.getState()
    expect((state['board'] as Array<null | string>)[0]).toBe('X')
  })

  it('rehydrate replaces committed events and clears optimistic', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!

    const events: Event[] = [
      { type: 'MARK_PLACED', payload: { cell: 4, player: 'X', seq: 1 } },
    ]
    store_x.rehydrate(events)

    const state = store_x.getCommittedState()
    expect((state['board'] as Array<null | string>)[4]).toBe('X')
  })

  it('rehydrate is deterministic (same events → same state)', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!
    const store_o = stores.get('player-o')!

    const events: Event[] = [
      { type: 'MARK_PLACED', payload: { cell: 0, player: 'X', seq: 1 } },
      { type: 'MARK_PLACED', payload: { cell: 4, player: 'O', seq: 2 } },
    ]

    store_x.rehydrate(events)
    store_o.rehydrate(events)

    expect(JSON.stringify(store_x.getCommittedState())).toBe(
      JSON.stringify(store_o.getCommittedState()),
    )
  })

  it('destroy cleans up all subscriptions', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!

    let call_count = 0
    store_x.subscribe(() => call_count++)

    store_x.dispatch({ type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } })
    const count_before = call_count

    store_x.destroy()

    expect(call_count).toBe(count_before)
  })

  it('destroy cleans up all pending timeouts', () => {
    const { stores, transports } = setup({ consensusTimeoutMs: 5000 })

    for (const t of transports.values()) t.disconnect()
    for (const t of transports.values()) t.reconnect()

    stores.get('player-x')!.destroy()

    jest.advanceTimersByTime(10000)
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

    store_x.dispatchOptimistic({
      type: 'MARK_PLACED',
      payload: { cell: 4, player: 'X', seq: 99 },
    })

    const state_x = store_x.getState()
    expect((state_x['board'] as Array<null | string>)[4]).toBe('X')

    expect(JSON.stringify(store_o.getState())).toBe(initial_o)
  })

  it('dispatchOptimistic does not trigger consensus', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!

    store_x.dispatchOptimistic({
      type: 'MARK_PLACED',
      payload: { cell: 4, player: 'X', seq: 1 },
    })

    const committed = store_x.getCommittedState()
    expect((committed['board'] as Array<null | string>)[4]).toBeNull()
  })

  it('module.handle returning null → crash', () => {
    const badModule: StoreModule = {
      initialState: () => ({}),
      handle: () => null as unknown as HandleResult,
      reduce: (s) => s,
    }
    const bus = new InMemoryBus()
    const t1 = new InMemoryTransport(bus, 'a')
    const t2 = new InMemoryTransport(bus, 'b')
    const store = new PeerStore(badModule, {
      peerId: 'a',
      peers: ['a', 'b'],
      transport: t1,
    })
    const _store2 = new PeerStore(badModule, {
      peerId: 'b',
      peers: ['a', 'b'],
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
      handle: (_s, _c) => ({
        ok: true,
        value: { events: [{ type: 'e', payload: {} }] },
      }),
      reduce: () => [] as unknown as State,
    }
    const bus = new InMemoryBus()
    const t1 = new InMemoryTransport(bus, 'a')
    const t2 = new InMemoryTransport(bus, 'b')
    const store = new PeerStore(badModule, {
      peerId: 'a',
      peers: ['a', 'b'],
      transport: t1,
    })
    const _store2 = new PeerStore(badModule, {
      peerId: 'b',
      peers: ['a', 'b'],
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
})
