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
import type { State } from '../types'
import { isSystemEvent } from '../utils'
import { ticTacToeBoardCell } from './tic-tac-toe-board'
import { TestCrashHandler } from './test-crash-handler'

const crash: Assert = Assert.crash()

let disposeCrashHandler: () => void
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler())
})
afterAll(() => disposeCrashHandler())

const TRUST = { 'player-x': 1, 'player-o': 1, 'authority': 3 }
const PEER_IDS = Object.keys(TRUST)

function createSim(opts?: { timeoutMs?: number }) {
  return new DeterministicSimulator(TicTacToeModule, {
    topic: 'cheat-test',
    initialMembership: TRUST,
    timeoutMs: opts?.timeoutMs ?? 5000,
    advanceTime: (ms) => jest.advanceTimersByTime(ms),
  })
}

function cell(state: State, index: number): null | string {
  return ticTacToeBoardCell(state, index)
}

function requireFiniteSeq(state: State): number {
  const s = state['seq']
  crash.number(s, 'state.seq must be a finite number')
  return s
}

function wireRecord(payload: unknown): Record<string, unknown> {
  crash.record(payload, 'wire payload must be a plain object')
  return payload
}

function tamperAcceptedMarkPlacedCell8(payload: unknown): unknown {
  const msg = wireRecord(payload)
  if (msg['kind'] !== 'accepted') return payload
  const entriesRaw = msg['entries']
  crash.array(entriesRaw, 'accepted.entries must be an array')
  const newEntries = entriesRaw.map((row) => {
    crash.record(row, 'log entry must be object')
    const seq = row['seq']
    crash.number(seq, 'entry.seq must be number')
    const event = row['event']
    crash.record(event, 'entry.event must be object')
    const type = event['type']
    if (type !== 'MARK_PLACED') return row
    const p = event['payload']
    crash.record(p, 'MARK_PLACED payload must be object')
    return {
      seq,
      event: {
        ...event,
        payload: { ...p, cell: 8 },
      },
    }
  })
  return { ...msg, entries: newEntries }
}

describe('Cheating: Authority', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('fabricated commit — client injects accepted message without authority', () => {
    const sim = createSim()

    sim.injectWireMessage({
      kind: 'accepted',
      commandId: 'fabricated-1',
      entries: [
        {
          seq: 4,
          event: { type: 'MARK_PLACED', payload: { cell: 4, player: 'X', seq: 1 } },
        },
      ],
    })

    for (const peerId of PEER_IDS) {
      expect(cell(sim.getCommittedState(peerId), 4)).toBe('X')
    }
    sim.destroy()
  })

  it('identity spoofing — player-o plays as X via payload mismatch', () => {
    const sim = createSim()

    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    sim.assertConverged()
    expect(cell(sim.getCommittedState('authority'), 0)).toBe('X')
    expect(sim.getCommittedState('authority')['currentTurn']).toBe('O')
    sim.destroy()
  })

  it('identity spoofing — forged peerId in injected propose', () => {
    const sim = createSim()

    const forged = sim.forgeCommand(
      'player-o',
      { type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } },
      { fakePeerId: 'player-x' },
    )
    sim.injectWireMessage({ kind: 'propose', command: forged })

    expect(cell(sim.getCommittedState('authority'), 0)).toBe('X')
    sim.destroy()
  })

  it('event tampering (MITM) — interceptor modifies accepted events', () => {
    const sim = createSim()

    sim.setMessageInterceptor((_topic, payload) =>
      tamperAcceptedMarkPlacedCell8(payload),
    )

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    expect(cell(sim.getCommittedState('authority'), 0)).toBe('X')
    expect(cell(sim.getCommittedState('authority'), 8)).toBeNull()

    expect(cell(sim.getCommittedState('player-x'), 8)).toBe('X')
    expect(cell(sim.getCommittedState('player-x'), 0)).toBeNull()

    sim.setMessageInterceptor(null)
    sim.destroy()
  })

  it('replay with same commandId — finalized set prevents double-commit', () => {
    const sim = createSim()

    let captured: unknown = null
    sim.setMessageInterceptor((_topic, payload) => {
      const msg = wireRecord(payload)
      if (msg['kind'] === 'accepted' && !captured) {
        captured = structuredClone(payload)
      }
      return payload
    })

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    sim.assertConverged()
    sim.setMessageInterceptor(null)

    const stateBefore = JSON.stringify(sim.getCommittedState('player-o'))
    sim.injectWireMessage(captured)
    const stateAfter = JSON.stringify(sim.getCommittedState('player-o'))

    expect(stateAfter).toBe(stateBefore)
    sim.destroy()
  })

  it('replay with new commandId — duplicate events are applied', () => {
    const sim = createSim()

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    sim.assertConverged()

    const eventCountBefore = sim.getEventLog('player-o').length
    const domain = sim
      .getCommittedLogEntries('authority')
      .filter((e) => !isSystemEvent(e.event))
    const start = sim.getLatestSeq('authority') + 1
    const replayEntries = domain.map((e, i) => ({
      seq: start + i,
      event: e.event,
    }))

    sim.injectWireMessage({
      kind: 'accepted',
      commandId: 'replayed-new-id',
      entries: replayEntries,
    })

    const eventCountAfter = sim.getEventLog('player-o').length
    expect(eventCountAfter).toBeGreaterThan(eventCountBefore)
    sim.destroy()
  })

  it('out-of-turn via injected propose — authority rejects, board unchanged', () => {
    const sim = createSim()

    const boardBefore = JSON.stringify(
      sim.getCommittedState('authority')['board'],
    )

    const forged = sim.forgeCommand('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'O' },
    })
    sim.injectWireMessage({ kind: 'propose', command: forged })

    const boardAfter = JSON.stringify(sim.getCommittedState('authority')['board'])
    expect(boardAfter).toBe(boardBefore)
    sim.destroy()
  })

  it('double propose — authority ignores the duplicate', () => {
    const sim = createSim()

    const cmd = sim.forgeCommand('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    sim.injectWireMessage({ kind: 'propose', command: cmd })
    expect(cell(sim.getCommittedState('authority'), 0)).toBe('X')

    const seqBefore = requireFiniteSeq(sim.getCommittedState('authority'))
    sim.injectWireMessage({ kind: 'propose', command: cmd })
    const seqAfter = requireFiniteSeq(sim.getCommittedState('authority'))

    expect(seqAfter).toBe(seqBefore)
    sim.destroy()
  })

  it('unknown message kind — silently ignored, state unchanged', () => {
    const sim = createSim()

    const stateBefore = JSON.stringify(sim.getCommittedState('authority'))

    sim.injectWireMessage({ kind: 'totally_bogus', data: 'garbage' })

    const stateAfter = JSON.stringify(sim.getCommittedState('authority'))
    expect(stateAfter).toBe(stateBefore)
    sim.destroy()
  })
})

describe('Cheating: Cross-cutting', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('flood attack — rapid-fire dispatches, no crash', () => {
    const sim = createSim()

    for (let i = 0; i < 50; i++) {
      try {
        sim.dispatch('player-x', {
          type: 'PLACE_MARK',
          payload: { cell: i % 9, player: i % 2 === 0 ? 'X' : 'O' },
        })
      } catch {
        // dispatch may throw for invalid moves — that's fine
      }
    }

    const state = sim.getCommittedState('authority')
    expect(state['board']).toBeDefined()
    expect(state['status']).toBeDefined()
    sim.destroy()
  })

  it('disconnect + cheat — inject messages while peer offline', () => {
    const sim = createSim()

    sim.disconnectPeer('player-o')

    sim.injectWireMessage({
      kind: 'accepted',
      commandId: 'offline-cheat-1',
      entries: [
        {
          seq: 4,
          event: { type: 'MARK_PLACED', payload: { cell: 0, player: 'X', seq: 1 } },
        },
      ],
    })

    expect(cell(sim.getCommittedState('authority'), 0)).toBe('X')
    expect(cell(sim.getCommittedState('player-o'), 0)).toBeNull()

    sim.reconnectPeer('player-o')

    expect(cell(sim.getCommittedState('player-o'), 0)).toBe('X')
    sim.destroy()
  })

  it('interceptor drop all — causes timeout on pending commands', () => {
    const sim = createSim({ timeoutMs: 3000 })

    sim.setMessageInterceptor(() => null)

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'X' },
    })

    expect(cell(sim.getState('player-x'), 4)).toBe('X')
    expect(cell(sim.getCommittedState('player-x'), 4)).toBeNull()

    sim.advanceTime(3001)

    expect(cell(sim.getState('player-x'), 4)).toBeNull()
    expect(sim.getTimeoutLog().length).toBe(1)

    sim.setMessageInterceptor(null)
    sim.destroy()
  })

  it('convergence after cheating — honest peers converge after junk injection', () => {
    const sim = createSim()

    sim.injectWireMessage({ kind: 'totally_bogus', data: [1, 2, 3] })
    sim.injectWireMessage({ kind: 'unknown', commandId: 'fake' })

    sim.dispatch('player-x', { type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } })
    sim.dispatch('player-o', { type: 'PLACE_MARK', payload: { cell: 3, player: 'O' } })
    sim.dispatch('player-x', { type: 'PLACE_MARK', payload: { cell: 1, player: 'X' } })

    sim.assertConverged()

    const auth = sim.getCommittedState('authority')
    expect(cell(auth, 0)).toBe('X')
    expect(cell(auth, 3)).toBe('O')
    expect(cell(auth, 1)).toBe('X')
    sim.destroy()
  })

  it('forgeCommand utility — produces command with overridden fields', () => {
    const sim = createSim()

    const cmd = sim.forgeCommand(
      'player-x',
      { type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } },
      { id: 'custom-id', seq: 42, fakePeerId: 'hacker' },
    )

    expect(cmd.id).toBe('custom-id')
    expect(cmd.seq).toBe(42)
    expect(cmd.peerId).toBe('hacker')
    expect(cmd.message.type).toBe('PLACE_MARK')
    sim.destroy()
  })
})
