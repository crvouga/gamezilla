import { Assert, ValidationError } from '@gamezilla/lib/assert'
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
  CellOccupiedError,
  ForfeitWin,
  GameWon,
  JoinSession,
  LeaveSession,
  NotSeatedError,
  NotYourMarkError,
  PlaceMark,
  Resign,
  TicTacToeModule,
  UnknownCommandError,
  WrongTurnError,
} from './fixtures/tic-tac-toe.module'
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
    sim.dispatch('player-x', PlaceMark({ cell: 4, player: 'X' }))
    sim.assertConverged()
    const state = sim.getCommittedState('player-x')
    expect(ticTacToeBoardCell(state, 4)).toBe('X')
    expect(state['currentTurn']).toBe('O')
    sim.destroy()
  })

  it('PLACE_MARK on wrong turn → rejected', () => {
    const sim = createSim()
    sim.dispatch('player-o', PlaceMark({ cell: 0, player: 'O' }))
    expect(sim.getErrorLog().length).toBe(1)
    expect(WrongTurnError.is(sim.getErrorLog()[0]!)).toBe(true)
    sim.destroy()
  })

  it('PLACE_MARK on occupied cell → rejected', () => {
    const sim = createSim()
    sim.dispatch('player-x', PlaceMark({ cell: 0, player: 'X' }))
    sim.dispatch('player-o', PlaceMark({ cell: 0, player: 'O' }))
    expect(sim.getErrorLog().some((e) => CellOccupiedError.is(e))).toBe(true)
    sim.destroy()
  })

  it('PLACE_MARK with cell=9 → ValidationError at tag construction', () => {
    const sim = createSim()
    expect(() =>
      sim.dispatch('player-x', PlaceMark({ cell: 9, player: 'X' })),
    ).toThrow(ValidationError)
    sim.destroy()
  })

  it('PLACE_MARK with invalid player → ValidationError in router', () => {
    const sim = createSim()
    expect(() =>
      sim.dispatch('player-x', {
        type: PlaceMark.type,
        payload: { cell: 0, player: 'Z' },
      }),
    ).toThrow(ValidationError)
    sim.destroy()
  })

  it('win condition: GAME_WON event produced, state converges', () => {
    const sim = createSim()
    sim.dispatch('player-x', PlaceMark({ cell: 0, player: 'X' }))
    sim.dispatch('player-o', PlaceMark({ cell: 3, player: 'O' }))
    sim.dispatch('player-x', PlaceMark({ cell: 1, player: 'X' }))
    sim.dispatch('player-o', PlaceMark({ cell: 4, player: 'O' }))
    sim.dispatch('player-x', PlaceMark({ cell: 2, player: 'X' }))

    sim.assertConverged()
    const state = sim.getCommittedState('player-x')
    expect(state['winner']).toBe('X')
    expect(state['status']).toBe('completed')

    const events = sim.getEventLog('player-x')
    expect(events.some((e) => GameWon.is(e))).toBe(true)
    sim.destroy()
  })

  it('draw condition: GAME_DRAWN event produced, state converges', () => {
    const sim = createSim()
    sim.dispatch('player-x', PlaceMark({ cell: 0, player: 'X' }))
    sim.dispatch('player-o', PlaceMark({ cell: 1, player: 'O' }))
    sim.dispatch('player-x', PlaceMark({ cell: 2, player: 'X' }))
    sim.dispatch('player-o', PlaceMark({ cell: 5, player: 'O' }))
    sim.dispatch('player-x', PlaceMark({ cell: 3, player: 'X' }))
    sim.dispatch('player-o', PlaceMark({ cell: 6, player: 'O' }))
    sim.dispatch('player-x', PlaceMark({ cell: 4, player: 'X' }))
    sim.dispatch('player-o', PlaceMark({ cell: 8, player: 'O' }))
    sim.dispatch('player-x', PlaceMark({ cell: 7, player: 'X' }))

    sim.assertConverged()
    const state = sim.getCommittedState('player-x')
    expect(state['winner']).toBe('draw')
    expect(state['status']).toBe('completed')
    sim.destroy()
  })

  it('RESIGN: PLAYER_RESIGNED produced, game ends', () => {
    const sim = createSim()
    sim.dispatch('player-o', Resign({ player: 'O' }))
    sim.assertConverged()
    const state = sim.getCommittedState('player-x')
    expect(state['winner']).toBe('X')
    expect(state['status']).toBe('completed')
    sim.destroy()
  })

  it('full game X wins — all moves committed, all peers converge', () => {
    const sim = createSim()
    sim.dispatch('player-x', PlaceMark({ cell: 0, player: 'X' }))
    sim.dispatch('player-o', PlaceMark({ cell: 3, player: 'O' }))
    sim.dispatch('player-x', PlaceMark({ cell: 1, player: 'X' }))
    sim.dispatch('player-o', PlaceMark({ cell: 4, player: 'O' }))
    sim.dispatch('player-x', PlaceMark({ cell: 2, player: 'X' }))

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
    sim.dispatch('player-x', PlaceMark({ cell: 0, player: 'X' }))

    expect(ticTacToeBoardCell(sim.getCommittedState('player-x'), 0)).toBe('X')
    expect(ticTacToeBoardCell(sim.getCommittedState('authority'), 0)).toBe('X')
    expect(ticTacToeBoardCell(sim.getCommittedState('player-o'), 0)).toBeNull()
    sim.destroy()
  })

  it('reconnect after partition: Player O syncs, state converges', () => {
    const sim = createSim()
    sim.disconnectPeer('player-o')
    sim.dispatch('player-x', PlaceMark({ cell: 0, player: 'X' }))

    sim.reconnectPeer('player-o')

    sim.assertConverged()
    sim.destroy()
  })

  it('timeout: authority offline, advance time, optimistic rolled back', () => {
    const sim = createSim({ timeoutMs: 5000 })

    sim.disconnectPeer('authority')

    sim.dispatch('player-x', PlaceMark({ cell: 0, player: 'X' }))
    expect(ticTacToeBoardCell(sim.getState('player-x'), 0)).toBe('X')

    sim.advanceTime(5001)
    expect(ticTacToeBoardCell(sim.getState('player-x'), 0)).toBeNull()
    expect(sim.getTimeoutLog().length).toBe(1)
    sim.destroy()
  })

  it('simultaneous dispatches from different peers both resolve correctly', () => {
    const sim = createSim()
    sim.dispatch('player-x', PlaceMark({ cell: 0, player: 'X' }))
    sim.dispatch('player-o', PlaceMark({ cell: 4, player: 'O' }))
    sim.dispatch('player-x', PlaceMark({ cell: 8, player: 'X' }))

    sim.assertConverged()
    const state = sim.getCommittedState('player-x')
    expect(ticTacToeBoardCell(state, 0)).toBe('X')
    expect(ticTacToeBoardCell(state, 4)).toBe('O')
    expect(ticTacToeBoardCell(state, 8)).toBe('X')
    sim.destroy()
  })

  it('unknown command type → tagged rejection, no crash', () => {
    const sim = createSim()
    sim.dispatch('player-x', { type: 'UNKNOWN', payload: {} })
    expect(sim.getErrorLog().some((e) => UnknownCommandError.is(e))).toBe(true)
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

    sim.dispatch('player-x', PlaceMark({ cell: 0, player: 'X' }))
    sim.assertConverged()
    expect(ticTacToeBoardCell(sim.getCommittedState('player-x'), 0)).toBe('X')

    sim.disconnectPeer('player-o')

    sim.dispatch('player-o', PlaceMark({ cell: 4, player: 'O' }))
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
    sim.dispatch('player-x', JoinSession({ mark: 'X' }))
    sim.dispatch('player-o', JoinSession({ mark: 'O' }))
    sim.assertConverged()

    sim.dispatch('player-o', PlaceMark({ cell: 0, player: 'X' }))
    expect(sim.getErrorLog().some((e) => NotYourMarkError.is(e))).toBe(true)

    sim.dispatch('player-x', PlaceMark({ cell: 0, player: 'X' }))
    sim.assertConverged()
    expect(ticTacToeBoardCell(sim.getCommittedState('player-x'), 0)).toBe('X')
    sim.destroy()
  })

  it('LEAVE_SESSION mid-game forfeits to the remaining seated peer', () => {
    const sim = createSim()
    sim.dispatch('player-x', JoinSession({ mark: 'X' }))
    sim.dispatch('player-o', JoinSession({ mark: 'O' }))
    sim.dispatch('player-x', PlaceMark({ cell: 4, player: 'X' }))
    sim.assertConverged()

    sim.dispatch('player-o', LeaveSession({}))
    sim.assertConverged()

    const state = sim.getCommittedState('player-x')
    expect(state['winner']).toBe('X')
    expect(state['status']).toBe('completed')
    expect(sim.getEventLog('player-x').some((e) => ForfeitWin.is(e))).toBe(true)
    sim.destroy()
  })

  it('LEAVE_SESSION without a seat → NOT_SEATED', () => {
    const sim = createSim()
    sim.dispatch('player-x', LeaveSession({}))
    expect(sim.getErrorLog().some((e) => NotSeatedError.is(e))).toBe(true)
    sim.destroy()
  })
})
