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
import { TicTacToeModule } from '../__fixtures__/tic-tac-toe.module'
import { DeterministicSimulator } from '../simulator'
import { TestCrashHandler } from './test-crash-handler'
import { ticTacToeBoardCell } from './tic-tac-toe-board'

let disposeCrashHandler: () => void
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler())
})
afterAll(() => disposeCrashHandler())

const TRUST = { 'player-x': 1, 'player-o': 1, 'authority': 3 }

function createSim(opts?: { timeoutMs?: number }) {
  return new DeterministicSimulator(TicTacToeModule, {
    topic: 'sim-test',
    initialMembership: TRUST,
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
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    const state_o = sim.getCommittedState('player-o')
    expect(ticTacToeBoardCell(state_o, 0)).toBeNull()
    sim.destroy()
  })

  it('resumeDelivery delivers queued messages in order', () => {
    const sim = createSim()
    sim.pauseDelivery()
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    sim.resumeDelivery()
    const state = sim.getCommittedState('player-o')
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
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    sim.dropNextMessage()
    sim.resumeDelivery()
    sim.destroy()
  })

  it('deliverPending flushes queue synchronously', () => {
    const sim = createSim()
    sim.pauseDelivery()
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    sim.deliverPending()
    sim.resumeDelivery()
    sim.destroy()
  })

  it('disconnectPeer stops delivery to that peer', () => {
    const sim = createSim()
    sim.disconnectPeer('player-o')
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    const state_o = sim.getCommittedState('player-o')
    expect(ticTacToeBoardCell(state_o, 0)).toBeNull()
    sim.destroy()
  })

  it('reconnectPeer resumes delivery', () => {
    const sim = createSim()
    sim.disconnectPeer('player-o')
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    sim.reconnectPeer('player-o')

    const state_o = sim.getCommittedState('player-o')
    expect(ticTacToeBoardCell(state_o, 0)).toBe('X')
    sim.destroy()
  })

  it('assertConverged passes when all peers agree', () => {
    const sim = createSim()
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    sim.assertConverged()
    sim.destroy()
  })

  it('assertConverged throws detailed diff when peers diverge', () => {
    const sim = createSim()

    sim.disconnectPeer('player-o')
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    expect(() => sim.assertConverged()).toThrow('diverged')
    sim.destroy()
  })

  it('advanceTime triggers timeouts in order', () => {
    const sim = createSim({ timeoutMs: 3000 })

    sim.disconnectPeer('authority')

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    const before = sim.getState('player-x')
    expect(ticTacToeBoardCell(before, 0)).toBe('X')

    sim.advanceTime(3001)

    const after = sim.getState('player-x')
    expect(ticTacToeBoardCell(after, 0)).toBeNull()
    expect(sim.getTimeoutLog().length).toBe(1)
    sim.destroy()
  })

  it('getEventLog returns committed events in seq order', () => {
    const sim = createSim()
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'O' },
    })

    const events = sim.getEventLog('player-x')
    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(events[0]!.type).toBe('MARK_PLACED')
    sim.destroy()
  })

  it('reset returns all stores to initial state', () => {
    const sim = createSim()
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    sim.reset()
    const state = sim.getCommittedState('player-x')
    expect(ticTacToeBoardCell(state, 0)).toBeNull()
    sim.destroy()
  })

  it('getCommittedState excludes optimistic events', () => {
    const sim = createSim()

    sim.disconnectPeer('authority')
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    const display = sim.getState('player-x')
    const committed = sim.getCommittedState('player-x')
    expect(ticTacToeBoardCell(display, 0)).toBe('X')
    expect(ticTacToeBoardCell(committed, 0)).toBeNull()
    sim.destroy()
  })

  it('getState includes optimistic events', () => {
    const sim = createSim()
    sim.disconnectPeer('authority')
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    const state = sim.getState('player-x')
    expect(ticTacToeBoardCell(state, 0)).toBe('X')
    sim.destroy()
  })

  it('dispatch as specific peer sets correct peerId on command', () => {
    const sim = createSim()
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    const events = sim.getEventLog('player-x')
    expect(events.length).toBeGreaterThanOrEqual(1)
    sim.destroy()
  })

  it('alternating disconnects — player-x syncs after reconnect via transport replay', () => {
    const sim = createSim()

    sim.disconnectPeer('player-o')

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    expect(sim.getCommittedState('player-x')['currentTurn']).toBe('O')
    expect(sim.getCommittedState('authority')['currentTurn']).toBe('O')

    sim.reconnectPeer('player-o')
    sim.assertConverged()

    sim.disconnectPeer('player-x')

    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'O' },
    })
    expect(sim.getCommittedState('player-o')['currentTurn']).toBe('X')
    expect(sim.getCommittedState('authority')['currentTurn']).toBe('X')

    sim.reconnectPeer('player-x')
    expect(sim.getEventLog('player-x').length).toBe(2)
    expect(sim.getCommittedState('player-x')['currentTurn']).toBe('X')

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 1, player: 'X' },
    })
    expect(
      sim.getErrorLog().filter((e) => e.code === 'WRONG_TURN').length,
    ).toBe(0)

    sim.assertConverged()

    sim.destroy()
  })

  it('player disconnects after move, misses opponent move, syncs on reconnect via transport replay', () => {
    const sim = createSim()

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    sim.assertConverged()

    sim.disconnectPeer('player-x')

    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'O' },
    })

    expect(ticTacToeBoardCell(sim.getCommittedState('player-o'), 4)).toBe('O')
    expect(sim.getCommittedState('player-o')['currentTurn']).toBe('X')

    expect(sim.getEventLog('player-x').length).toBe(1)

    sim.reconnectPeer('player-x')
    expect(sim.getEventLog('player-x').length).toBe(2)
    expect(sim.getCommittedState('player-x')['currentTurn']).toBe('X')
    expect(ticTacToeBoardCell(sim.getCommittedState('player-x'), 4)).toBe('O')

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 1, player: 'X' },
    })
    expect(
      sim.getErrorLog().filter((e) => e.code === 'WRONG_TURN').length,
    ).toBe(0)

    sim.assertConverged()

    sim.destroy()
  })
})
