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
const PEER_IDS = Object.keys(TRUST)

function createSim(opts?: { timeoutMs?: number }) {
  return new DeterministicSimulator(TicTacToeModule, {
    topic: 'tic-tac-toe-sim',
    initialMembership: TRUST,
    timeoutMs: opts?.timeoutMs ?? 5000,
    advanceTime: (ms) => jest.advanceTimersByTime(ms),
  })
}

describe('TicTacToe integration', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('valid PLACE_MARK committed by all peers, state converges', () => {
    const sim = createSim()
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'X' },
    })
    sim.assertConverged()
    const state = sim.getCommittedState('player-x')
    expect(ticTacToeBoardCell(state, 4)).toBe('X')
    expect(state['currentTurn']).toBe('O')
    sim.destroy()
  })

  it('PLACE_MARK on wrong turn → rejected', () => {
    const sim = createSim()
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'O' },
    })
    expect(sim.getErrorLog().length).toBe(1)
    expect(sim.getErrorLog()[0]!.code).toBe('WRONG_TURN')
    sim.destroy()
  })

  it('PLACE_MARK on occupied cell → rejected', () => {
    const sim = createSim()
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'O' },
    })
    expect(sim.getErrorLog().some((e) => e.code === 'CELL_OCCUPIED')).toBe(
      true,
    )
    sim.destroy()
  })

  it('PLACE_MARK with cell=9 → StoreError at validation', () => {
    const sim = createSim()
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 9, player: 'X' },
    })
    expect(sim.getErrorLog().some((e) => e.code === 'INVALID_CELL')).toBe(true)
    sim.destroy()
  })

  it('PLACE_MARK with invalid player → StoreError at validation', () => {
    const sim = createSim()
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'Z' },
    })
    expect(sim.getErrorLog().some((e) => e.code === 'INVALID_PLAYER')).toBe(
      true,
    )
    sim.destroy()
  })

  it('win condition: GAME_WON event produced, state converges', () => {
    const sim = createSim()
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 3, player: 'O' },
    })
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 1, player: 'X' },
    })
    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'O' },
    })
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 2, player: 'X' },
    })

    sim.assertConverged()
    const state = sim.getCommittedState('player-x')
    expect(state['winner']).toBe('X')
    expect(state['status']).toBe('completed')

    const events = sim.getEventLog('player-x')
    expect(events.some((e) => e.type === 'GAME_WON')).toBe(true)
    sim.destroy()
  })

  it('draw condition: GAME_DRAWN event produced, state converges', () => {
    const sim = createSim()
    sim.dispatch('player-x', { type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } })
    sim.dispatch('player-o', { type: 'PLACE_MARK', payload: { cell: 1, player: 'O' } })
    sim.dispatch('player-x', { type: 'PLACE_MARK', payload: { cell: 2, player: 'X' } })
    sim.dispatch('player-o', { type: 'PLACE_MARK', payload: { cell: 5, player: 'O' } })
    sim.dispatch('player-x', { type: 'PLACE_MARK', payload: { cell: 3, player: 'X' } })
    sim.dispatch('player-o', { type: 'PLACE_MARK', payload: { cell: 6, player: 'O' } })
    sim.dispatch('player-x', { type: 'PLACE_MARK', payload: { cell: 4, player: 'X' } })
    sim.dispatch('player-o', { type: 'PLACE_MARK', payload: { cell: 8, player: 'O' } })
    sim.dispatch('player-x', { type: 'PLACE_MARK', payload: { cell: 7, player: 'X' } })

    sim.assertConverged()
    const state = sim.getCommittedState('player-x')
    expect(state['winner']).toBe('draw')
    expect(state['status']).toBe('completed')
    sim.destroy()
  })

  it('RESIGN: PLAYER_RESIGNED produced, game ends', () => {
    const sim = createSim()
    sim.dispatch('player-o', { type: 'RESIGN', payload: { player: 'O' } })
    sim.assertConverged()
    const state = sim.getCommittedState('player-x')
    expect(state['winner']).toBe('X')
    expect(state['status']).toBe('completed')
    sim.destroy()
  })

  it('full game X wins — all moves committed, all peers converge', () => {
    const sim = createSim()
    sim.dispatch('player-x', { type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } })
    sim.dispatch('player-o', { type: 'PLACE_MARK', payload: { cell: 3, player: 'O' } })
    sim.dispatch('player-x', { type: 'PLACE_MARK', payload: { cell: 1, player: 'X' } })
    sim.dispatch('player-o', { type: 'PLACE_MARK', payload: { cell: 4, player: 'O' } })
    sim.dispatch('player-x', { type: 'PLACE_MARK', payload: { cell: 2, player: 'X' } })

    sim.assertConverged()
    for (const peerId of PEER_IDS) {
      const state = sim.getCommittedState(peerId)
      expect(state['winner']).toBe('X')
    }
    sim.destroy()
  })

  it('partition: Player O offline, X move commits via authority', () => {
    const sim = createSim()
    sim.disconnectPeer('player-o')
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    expect(ticTacToeBoardCell(sim.getCommittedState('player-x'), 0)).toBe('X')
    expect(ticTacToeBoardCell(sim.getCommittedState('authority'), 0)).toBe('X')
    expect(ticTacToeBoardCell(sim.getCommittedState('player-o'), 0)).toBeNull()
    sim.destroy()
  })

  it('reconnect after partition: Player O syncs, state converges', () => {
    const sim = createSim()
    sim.disconnectPeer('player-o')
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    sim.reconnectPeer('player-o')

    sim.assertConverged()
    sim.destroy()
  })

  it('timeout: authority offline, advance time, optimistic rolled back', () => {
    const sim = createSim({ timeoutMs: 5000 })

    sim.disconnectPeer('authority')

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    expect(ticTacToeBoardCell(sim.getState('player-x'), 0)).toBe('X')

    sim.advanceTime(5001)
    expect(ticTacToeBoardCell(sim.getState('player-x'), 0)).toBeNull()
    expect(sim.getTimeoutLog().length).toBe(1)
    sim.destroy()
  })

  it('simultaneous dispatches from different peers both resolve correctly', () => {
    const sim = createSim()
    sim.dispatch('player-x', { type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } })
    sim.dispatch('player-o', { type: 'PLACE_MARK', payload: { cell: 4, player: 'O' } })
    sim.dispatch('player-x', { type: 'PLACE_MARK', payload: { cell: 8, player: 'X' } })

    sim.assertConverged()
    const state = sim.getCommittedState('player-x')
    expect(ticTacToeBoardCell(state, 0)).toBe('X')
    expect(ticTacToeBoardCell(state, 4)).toBe('O')
    expect(ticTacToeBoardCell(state, 8)).toBe('X')
    sim.destroy()
  })

  it('unknown command type → StoreError, no crash', () => {
    const sim = createSim()
    sim.dispatch('player-x', { type: 'UNKNOWN', payload: {} })
    expect(sim.getErrorLog().some((e) => e.code === 'UNKNOWN_COMMAND')).toBe(
      true,
    )
    sim.destroy()
  })

  it('unknown event type → state unchanged, no crash', () => {
    const sim = createSim()
    const store = sim.getStore('player-x')
    const base = store.getCommittedLogEntries()
    const maxSeq = base.reduce((m, e) => Math.max(m, e.seq), 0)
    const before = JSON.stringify(store.getCommittedState())
    store.rehydrate([
      ...base,
      { seq: maxSeq + 1, event: { type: 'UNKNOWN_EVENT', payload: {} } },
    ])
    const after = JSON.stringify(store.getCommittedState())
    expect(after).toBe(before)
    sim.destroy()
  })

  it('offline dispatch: move made while offline is committed after reconnection', () => {
    const sim = createSim({ timeoutMs: 5000 })

    sim.dispatch('player-x', { type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } })
    sim.assertConverged()
    expect(ticTacToeBoardCell(sim.getCommittedState('player-x'), 0)).toBe('X')

    sim.disconnectPeer('player-o')

    sim.dispatch('player-o', { type: 'PLACE_MARK', payload: { cell: 4, player: 'O' } })
    expect(ticTacToeBoardCell(sim.getState('player-o'), 4)).toBe('O')

    sim.reconnectPeer('player-o')

    sim.advanceTime(5001)

    expect(ticTacToeBoardCell(sim.getState('player-o'), 4)).toBe('O')
    expect(ticTacToeBoardCell(sim.getCommittedState('player-o'), 4)).toBe('O')

    sim.destroy()
  })
})

describe('TicTacToe session seats (join / leave)', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('JOIN_SESSION then PLACE_MARK enforces command.peerId vs claimed mark', () => {
    const sim = createSim()
    sim.dispatch('player-x', { type: 'JOIN_SESSION', payload: { mark: 'X' } })
    sim.dispatch('player-o', { type: 'JOIN_SESSION', payload: { mark: 'O' } })
    sim.assertConverged()

    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    expect(sim.getErrorLog().some((e) => e.code === 'NOT_YOUR_MARK')).toBe(true)

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    sim.assertConverged()
    expect(ticTacToeBoardCell(sim.getCommittedState('player-x'), 0)).toBe('X')
    sim.destroy()
  })

  it('LEAVE_SESSION mid-game forfeits to the remaining seated peer', () => {
    const sim = createSim()
    sim.dispatch('player-x', { type: 'JOIN_SESSION', payload: { mark: 'X' } })
    sim.dispatch('player-o', { type: 'JOIN_SESSION', payload: { mark: 'O' } })
    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'X' },
    })
    sim.assertConverged()

    sim.dispatch('player-o', { type: 'LEAVE_SESSION', payload: {} })
    sim.assertConverged()

    const state = sim.getCommittedState('player-x')
    expect(state['winner']).toBe('X')
    expect(state['status']).toBe('completed')
    expect(
      sim.getEventLog('player-x').some((e) => e.type === 'FORFEIT_WIN'),
    ).toBe(true)
    sim.destroy()
  })

  it('LEAVE_SESSION without a seat → NOT_SEATED', () => {
    const sim = createSim()
    sim.dispatch('player-x', { type: 'LEAVE_SESSION', payload: {} })
    expect(sim.getErrorLog().some((e) => e.code === 'NOT_SEATED')).toBe(true)
    sim.destroy()
  })
})
