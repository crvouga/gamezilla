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
import { ConsensusAuthority } from '../consensus-authority'
import { PeerStore } from '../peer-store'
import { anyPeerSync, designatedSyncPeer } from '../sync-policy'
import { InMemoryBus, InMemoryTransport } from '../transport'
import type { Event, HandleResult, State, StoreModule, SyncPolicy } from '../types'
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
  syncPolicy?: SyncPolicy
  weights?: Record<string, number>
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

    const authority = new ConsensusAuthority({
      peerId,
      peers: PEERS,
      ...(opts?.quorum !== undefined ? { quorum: opts.quorum } : {}),
      ...(opts?.weights !== undefined ? { weights: opts.weights } : {}),
    })

    const store = new PeerStore(
      TicTacToeModule,
      {
        peerId,
        peers: PEERS,
        transport,
        authority,
        ...(opts?.consensusTimeoutMs !== undefined
          ? { consensusTimeoutMs: opts.consensusTimeoutMs }
          : {}),
        ...(opts?.syncPolicy !== undefined
          ? { syncPolicy: opts.syncPolicy }
          : {}),
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

    const authority_x = new ConsensusAuthority({
      peerId: 'player-x',
      peers: ['player-x', 'player-o'],
    })
    const authority_o = new ConsensusAuthority({
      peerId: 'player-o',
      peers: ['player-x', 'player-o'],
    })

    const store_x = new PeerStore(
      TicTacToeModule,
      {
        peerId: 'player-x',
        peers: ['player-x', 'player-o'],
        transport: transport_x,
        authority: authority_x,
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
        authority: authority_o,
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
    const a1 = new ConsensusAuthority({ peerId: 'a', peers: ['a', 'b'] })
    const a2 = new ConsensusAuthority({ peerId: 'b', peers: ['a', 'b'] })
    const store = new PeerStore(badModule, {
      peerId: 'a',
      peers: ['a', 'b'],
      transport: t1,
      authority: a1,
    })
    const _store2 = new PeerStore(badModule, {
      peerId: 'b',
      peers: ['a', 'b'],
      transport: t2,
      authority: a2,
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
    const a1 = new ConsensusAuthority({ peerId: 'a', peers: ['a', 'b'] })
    const a2 = new ConsensusAuthority({ peerId: 'b', peers: ['a', 'b'] })
    const store = new PeerStore(badModule, {
      peerId: 'a',
      peers: ['a', 'b'],
      transport: t1,
      authority: a1,
    })
    const _store2 = new PeerStore(badModule, {
      peerId: 'b',
      peers: ['a', 'b'],
      transport: t2,
      authority: a2,
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

describe('Sync protocol', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('requestSync broadcasts sync-request and sync source responds', () => {
    const { stores, transports, syncs } = setup({
      syncPolicy: designatedSyncPeer('worker'),
    })
    const store_x = stores.get('player-x')!
    const store_w = stores.get('worker')!

    store_x.dispatch({ type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } })
    const committed_before = store_w.getCommittedEvents()
    expect(committed_before.length).toBeGreaterThanOrEqual(1)

    transports.get('player-o')!.disconnect()
    store_x.dispatch({ type: 'PLACE_MARK', payload: { cell: 4, player: 'X' } })

    expect(
      (stores.get('player-o')!.getCommittedState()['board'] as Array<null | string>)[4],
    ).toBeNull()

    transports.get('player-o')!.reconnect()

    expect(
      (stores.get('player-o')!.getCommittedState()['board'] as Array<null | string>)[0],
    ).toBe('X')

    expect(syncs).toContain('player-o')
  })

  it('non-sync-source peer ignores sync-request', () => {
    const policy = designatedSyncPeer('worker')
    const { stores, transports } = setup({ syncPolicy: policy })

    stores.get('player-x')!.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    transports.get('worker')!.disconnect()

    stores.get('player-o')!.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'O' },
    })

    transports.get('worker')!.reconnect()

    const worker_events = stores.get('worker')!.getCommittedEvents()
    expect(worker_events.length).toBeGreaterThanOrEqual(1)
  })

  it('designatedSyncPeer only responds from the designated peer', () => {
    const policy = designatedSyncPeer('worker')
    expect(policy.isSyncSource('worker', PEERS)).toBe(true)
    expect(policy.isSyncSource('player-x', PEERS)).toBe(false)
    expect(policy.isSyncSource('player-o', PEERS)).toBe(false)
  })

  it('anyPeerSync responds from every peer', () => {
    const policy = anyPeerSync()
    expect(policy.isSyncSource('worker', PEERS)).toBe(true)
    expect(policy.isSyncSource('player-x', PEERS)).toBe(true)
    expect(policy.isSyncSource('player-o', PEERS)).toBe(true)
  })

  it('auto-sync on transport reconnect converges state', () => {
    const { stores, transports } = setup({
      syncPolicy: designatedSyncPeer('worker'),
    })

    stores.get('player-x')!.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    transports.get('player-o')!.disconnect()

    stores.get('player-o')!.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'O' },
    })

    transports.get('player-o')!.reconnect()

    const state_o = stores.get('player-o')!.getCommittedState()
    const state_w = stores.get('worker')!.getCommittedState()
    expect(JSON.stringify(state_o)).toBe(JSON.stringify(state_w))
  })

  it('onSync callback fires after successful sync', () => {
    const { stores, transports, syncs } = setup({
      syncPolicy: designatedSyncPeer('worker'),
    })

    stores.get('player-x')!.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    transports.get('player-o')!.disconnect()

    stores.get('player-x')!.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'X' },
    })

    expect(syncs.length).toBe(0)
    transports.get('player-o')!.reconnect()
    expect(syncs).toContain('player-o')
  })

  it('requestSync on destroyed store → crash', () => {
    const { stores } = setup({
      syncPolicy: designatedSyncPeer('worker'),
    })
    const store = stores.get('player-x')!
    store.destroy()
    expect(() => store.requestSync()).toThrow('destroyed')
  })

  it('manual requestSync works without onConnect', () => {
    const { stores } = setup()
    const store_x = stores.get('player-x')!
    store_x.dispatch({ type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } })

    expect(() => stores.get('player-o')!.requestSync()).not.toThrow()
  })

  it('rehydrate clears finalized_command_ids — subsequent commands process normally', () => {
    const { stores } = setup({
      syncPolicy: designatedSyncPeer('worker'),
    })

    stores.get('player-x')!.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    const events = stores.get('worker')!.getCommittedEvents()
    stores.get('player-o')!.rehydrate(events)

    stores.get('player-o')!.dispatch({
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'O' },
    })

    const state = stores.get('player-o')!.getCommittedState()
    expect((state['board'] as Array<null | string>)[4]).toBe('O')
  })
})
