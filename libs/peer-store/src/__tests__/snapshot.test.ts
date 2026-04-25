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
import { PlaceMark, TicTacToeModule } from '../__fixtures__/tic-tac-toe.module'
import { DeterministicSimulator } from '../simulator'
import { TestCrashHandler } from './test-crash-handler'
import { ticTacToeBoardCell } from './tic-tac-toe-board'

let disposeCrashHandler: () => void
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler())
})
afterAll(() => disposeCrashHandler())

const BASE = { 'player-x': 1, 'player-o': 1, 'authority': 3 }

describe('Snapshot and incremental sync', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('authority retains full committed log for domain moves', () => {
    const sim = new DeterministicSimulator(TicTacToeModule, {
      topic: 'snapshot-test',
      initialMembership: { ...BASE },
      advanceTime: (ms) => jest.advanceTimersByTime(ms),
    })

    sim.dispatch('authority', PlaceMark({ cell: 4, player: 'X' }))
    sim.deliverPending()

    expect(sim.getCommittedLogEntries('authority').length).toBe(4)
    expect(sim.getLatestSeq('authority')).toBe(4)

    sim.destroy()
  })

  it('late joiner syncs after authority has moved', () => {
    const sim = new DeterministicSimulator(TicTacToeModule, {
      topic: 'snapshot-join',
      initialMembership: { ...BASE },
      advanceTime: (ms) => jest.advanceTimersByTime(ms),
    })

    sim.dispatch('authority', PlaceMark({ cell: 4, player: 'X' }))
    sim.deliverPending()

    sim.joinPeer('late', 1)
    sim.deliverPending()

    expect(sim.getStore('late').getMembership()['late']).toBe(1)
    expect(ticTacToeBoardCell(sim.getCommittedState('late'), 4)).toBe('X')

    sim.destroy()
  })
})
