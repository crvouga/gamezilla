import { Assert } from '@gamezilla/lib/assert'
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
import {
  MarkPlaced,
  PlaceMark,
  TicTacToeModule,
  WrongTurnError,
} from '../testkit/fixtures/tic-tac-toe.module'
import { DeterministicSimulator } from './simulator'
import { TestCrashHandler } from '../testkit/test-crash-handler'
import { ticTacToeBoardCell } from '../testkit/tic-tac-toe-board'
import { ticTacToeThreePeers } from '../testkit/tic-tac-toe-peers'

let disposeCrashHandler: () => void
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler())
})
afterAll(() => disposeCrashHandler())

const FIX = ticTacToeThreePeers()
const PEER = {
  authority: FIX.peers.authority.peerId,
  playerX: FIX.peers.playerX.peerId,
  playerO: FIX.peers.playerO.peerId,
} as const

function createSim(opts?: { timeoutMs?: number }) {
  return new DeterministicSimulator(TicTacToeModule, {
    topic: 'sim-test',
    initialMembership: FIX.initialMembership,
    initialMemberPublicKeys: FIX.initialMemberPublicKeys,
    roomSecret: FIX.roomSecret,
    peerSecretSeeds: FIX.peerSecretSeeds,
    advanceTime: (ms) => jest.advanceTimersByTime(ms),
    ...(opts?.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
  })
}

describe('DeterministicSimulator', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('pauseDelivery holds messages in queue', () => {
    const sim = createSim()
    sim.pauseDelivery()
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))
    const state_o = sim.getCommittedState(PEER.playerO)
    expect(ticTacToeBoardCell(state_o, 0)).toBeNull()
    sim.destroy()
  })

  it('resumeDelivery delivers queued messages in order', () => {
    const sim = createSim()
    sim.pauseDelivery()
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))
    sim.resumeDelivery()
    const state = sim.getCommittedState(PEER.playerO)
    expect(ticTacToeBoardCell(state, 0)).toBe('X')
    sim.destroy()
  })

  it('pauseDelivery while paused → crash', () => {
    const sim = createSim()
    sim.pauseDelivery()
    expect(() => sim.pauseDelivery()).toThrow('already paused')
    sim.destroy()
  })

  it('resumeDelivery while not paused → crash', () => {
    const sim = createSim()
    expect(() => sim.resumeDelivery()).toThrow('not paused')
    sim.destroy()
  })

  it('dropNextMessage loses exactly one message', () => {
    const sim = createSim()
    sim.pauseDelivery()
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))
    sim.dropNextMessage()
    sim.resumeDelivery()
    sim.destroy()
  })

  it('deliverPending flushes queue synchronously', () => {
    const sim = createSim()
    sim.pauseDelivery()
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))
    sim.deliverPending()
    sim.resumeDelivery()
    sim.destroy()
  })

  it('disconnectPeer stops delivery to that peer', () => {
    const sim = createSim()
    sim.disconnectPeer(PEER.playerO)
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))
    const state_o = sim.getCommittedState(PEER.playerO)
    expect(ticTacToeBoardCell(state_o, 0)).toBeNull()
    sim.destroy()
  })

  it('reconnectPeer resumes delivery', () => {
    const sim = createSim()
    sim.disconnectPeer(PEER.playerO)
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))
    sim.reconnectPeer(PEER.playerO)

    const state_o = sim.getCommittedState(PEER.playerO)
    expect(ticTacToeBoardCell(state_o, 0)).toBe('X')
    sim.destroy()
  })

  it('assertConverged passes when all peers agree', () => {
    const sim = createSim()
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))
    sim.assertConverged()
    sim.destroy()
  })

  it('assertConverged throws detailed diff when peers diverge', () => {
    const sim = createSim()

    sim.disconnectPeer(PEER.playerO)
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))

    expect(() => sim.assertConverged()).toThrow('diverged')
    sim.destroy()
  })

  it('advanceTime triggers timeouts in order', () => {
    const sim = createSim({ timeoutMs: 3000 })

    sim.disconnectPeer(PEER.authority)

    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))

    const before = sim.getState(PEER.playerX)
    expect(ticTacToeBoardCell(before, 0)).toBe('X')

    sim.advanceTime(3001)

    const after = sim.getState(PEER.playerX)
    expect(ticTacToeBoardCell(after, 0)).toBeNull()
    expect(sim.getTimeoutLog().length).toBe(1)
    sim.destroy()
  })

  it('getEventLog returns committed events in seq order', () => {
    const sim = createSim()
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))
    sim.dispatch(PEER.playerO, PlaceMark({ cell: 4, player: 'O' }))

    const events = sim.getEventLog(PEER.playerX)
    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(MarkPlaced.is(events[0]!)).toBe(true)
    sim.destroy()
  })

  it('reset returns all stores to initial state', () => {
    const sim = createSim()
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))
    sim.reset()
    const state = sim.getCommittedState(PEER.playerX)
    expect(ticTacToeBoardCell(state, 0)).toBeNull()
    sim.destroy()
  })

  it('getCommittedState excludes optimistic events', () => {
    const sim = createSim()

    sim.disconnectPeer(PEER.authority)
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))

    const display = sim.getState(PEER.playerX)
    const committed = sim.getCommittedState(PEER.playerX)
    expect(ticTacToeBoardCell(display, 0)).toBe('X')
    expect(ticTacToeBoardCell(committed, 0)).toBeNull()
    sim.destroy()
  })

  it('getState includes optimistic events', () => {
    const sim = createSim()
    sim.disconnectPeer(PEER.authority)
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))
    const state = sim.getState(PEER.playerX)
    expect(ticTacToeBoardCell(state, 0)).toBe('X')
    sim.destroy()
  })

  it('dispatch as specific peer sets correct peerId on command', () => {
    const sim = createSim()
    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))
    const events = sim.getEventLog(PEER.playerX)
    expect(events.length).toBeGreaterThanOrEqual(1)
    sim.destroy()
  })

  it('alternating disconnects — player-x syncs after reconnect via transport replay', () => {
    const sim = createSim()

    sim.disconnectPeer(PEER.playerO)

    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))
    expect(sim.getCommittedState(PEER.playerX)['currentTurn']).toBe('O')
    expect(sim.getCommittedState(PEER.authority)['currentTurn']).toBe('O')

    sim.reconnectPeer(PEER.playerO)
    sim.assertConverged()

    sim.disconnectPeer(PEER.playerX)

    sim.dispatch(PEER.playerO, PlaceMark({ cell: 4, player: 'O' }))
    expect(sim.getCommittedState(PEER.playerO)['currentTurn']).toBe('X')
    expect(sim.getCommittedState(PEER.authority)['currentTurn']).toBe('X')

    sim.reconnectPeer(PEER.playerX)
    expect(sim.getEventLog(PEER.playerX).length).toBe(2)
    expect(sim.getCommittedState(PEER.playerX)['currentTurn']).toBe('X')

    sim.dispatch(PEER.playerX, PlaceMark({ cell: 1, player: 'X' }))
    expect(
      sim.getErrorLog().filter((e) => WrongTurnError.is(e)).length,
    ).toBe(0)

    sim.assertConverged()

    sim.destroy()
  })

  it('player disconnects after move, misses opponent move, syncs on reconnect via transport replay', () => {
    const sim = createSim()

    sim.dispatch(PEER.playerX, PlaceMark({ cell: 0, player: 'X' }))
    sim.assertConverged()

    sim.disconnectPeer(PEER.playerX)

    sim.dispatch(PEER.playerO, PlaceMark({ cell: 4, player: 'O' }))

    expect(ticTacToeBoardCell(sim.getCommittedState(PEER.playerO), 4)).toBe('O')
    expect(sim.getCommittedState(PEER.playerO)['currentTurn']).toBe('X')

    expect(sim.getEventLog(PEER.playerX).length).toBe(1)

    sim.reconnectPeer(PEER.playerX)
    expect(sim.getEventLog(PEER.playerX).length).toBe(2)
    expect(sim.getCommittedState(PEER.playerX)['currentTurn']).toBe('X')
    expect(ticTacToeBoardCell(sim.getCommittedState(PEER.playerX), 4)).toBe('O')

    sim.dispatch(PEER.playerX, PlaceMark({ cell: 1, player: 'X' }))
    expect(
      sim.getErrorLog().filter((e) => WrongTurnError.is(e)).length,
    ).toBe(0)

    sim.assertConverged()

    sim.destroy()
  })
})
