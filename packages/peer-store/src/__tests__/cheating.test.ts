import { Assert } from '@gamezilla/shared/assert'
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
import { ServerAuthority } from '../server-authority'
import { DeterministicSimulator } from '../simulator'
import type { State } from '../types'
import { TestCrashHandler } from './test-crash-handler'

let disposeCrashHandler: () => void
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler())
})
afterAll(() => disposeCrashHandler())

const SERVER_PEERS = ['player-x', 'player-o', 'server']
const CONSENSUS_PEERS = ['player-x', 'player-o', 'worker']

function createServerSim(opts?: { consensusTimeoutMs?: number }) {
  return new DeterministicSimulator(TicTacToeModule, {
    peers: SERVER_PEERS,
    consensusTimeoutMs: opts?.consensusTimeoutMs ?? 5000,
    advanceTime: (ms) => jest.advanceTimersByTime(ms),
    syncPolicy: 'server',
    createAuthority: ({ peerId }) =>
      new ServerAuthority({ peerId, serverId: 'server' }),
  })
}

function createConsensusSim(opts?: { consensusTimeoutMs?: number }) {
  return new DeterministicSimulator(TicTacToeModule, {
    peers: CONSENSUS_PEERS,
    consensusTimeoutMs: opts?.consensusTimeoutMs ?? 5000,
    advanceTime: (ms) => jest.advanceTimersByTime(ms),
    syncPolicy: 'worker',
  })
}

function board(state: State): Array<null | string> {
  return state['board'] as Array<null | string>
}

// ─── Server Authority ────────────────────────────────────────────────

describe('Cheating: Server Authority', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('fabricated commit — client injects committed message without server', () => {
    const sim = createServerSim()

    sim.injectWireMessage({
      kind: 'committed',
      commandId: 'fabricated-1',
      events: [
        { type: 'MARK_PLACED', payload: { cell: 4, player: 'X', seq: 1 } },
      ],
    })

    for (const peerId of SERVER_PEERS) {
      expect(board(sim.getCommittedState(peerId))[4]).toBe('X')
    }
    sim.destroy()
  })

  it('identity spoofing — player-o plays as X via payload mismatch', () => {
    const sim = createServerSim()

    sim.dispatch('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    sim.assertConverged()
    expect(board(sim.getCommittedState('server'))[0]).toBe('X')
    expect(sim.getCommittedState('server')['currentTurn']).toBe('O')
    sim.destroy()
  })

  it('identity spoofing — forged peerId in injected submit', () => {
    const sim = createServerSim()

    const forged = sim.forgeCommand(
      'player-o',
      { type: 'PLACE_MARK', payload: { cell: 0, player: 'X' } },
      { fakePeerId: 'player-x' },
    )
    sim.injectWireMessage({ kind: 'submit', command: forged })

    expect(board(sim.getCommittedState('server'))[0]).toBe('X')
    sim.destroy()
  })

  it('event tampering (MITM) — interceptor modifies committed events', () => {
    const sim = createServerSim()

    sim.setMessageInterceptor((_topic, payload) => {
      const msg = payload as Record<string, unknown>
      if (msg['kind'] === 'committed') {
        const events = msg['events'] as Array<Record<string, unknown>>
        return {
          ...msg,
          events: events.map((e) => {
            if (e['type'] === 'MARK_PLACED') {
              const p = e['payload'] as Record<string, unknown>
              return { ...e, payload: { ...p, cell: 8 } }
            }
            return e
          }),
        }
      }
      return payload
    })

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    expect(board(sim.getCommittedState('server'))[0]).toBe('X')
    expect(board(sim.getCommittedState('server'))[8]).toBeNull()

    expect(board(sim.getCommittedState('player-x'))[8]).toBe('X')
    expect(board(sim.getCommittedState('player-x'))[0]).toBeNull()

    sim.setMessageInterceptor(null)
    sim.destroy()
  })

  it('replay with same commandId — resolved set prevents double-commit', () => {
    const sim = createServerSim()

    let captured: unknown = null
    sim.setMessageInterceptor((_topic, payload) => {
      const msg = payload as Record<string, unknown>
      if (msg['kind'] === 'committed' && !captured) {
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
    const sim = createServerSim()

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })
    sim.assertConverged()

    const eventCountBefore = sim.getEventLog('player-o').length
    const events = sim.getEventLog('server')

    sim.injectWireMessage({
      kind: 'committed',
      commandId: 'replayed-new-id',
      events: [...events],
    })

    const eventCountAfter = sim.getEventLog('player-o').length
    expect(eventCountAfter).toBeGreaterThan(eventCountBefore)
    sim.destroy()
  })

  it('out-of-turn via injected submit — server rejects, board unchanged', () => {
    const sim = createServerSim()

    const boardBefore = JSON.stringify(board(sim.getCommittedState('server')))

    const forged = sim.forgeCommand('player-o', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'O' },
    })
    sim.injectWireMessage({ kind: 'submit', command: forged })

    const boardAfter = JSON.stringify(board(sim.getCommittedState('server')))
    expect(boardAfter).toBe(boardBefore)
    sim.destroy()
  })

  it('double submit — server ignores the duplicate', () => {
    const sim = createServerSim()

    const cmd = sim.forgeCommand('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 0, player: 'X' },
    })

    sim.injectWireMessage({ kind: 'submit', command: cmd })
    expect(board(sim.getCommittedState('server'))[0]).toBe('X')

    const seqBefore = sim.getCommittedState('server')['seq'] as number
    sim.injectWireMessage({ kind: 'submit', command: cmd })
    const seqAfter = sim.getCommittedState('server')['seq'] as number

    expect(seqAfter).toBe(seqBefore)
    sim.destroy()
  })

  it('unknown message kind — silently ignored, state unchanged', () => {
    const sim = createServerSim()

    const stateBefore = JSON.stringify(sim.getCommittedState('server'))

    sim.injectWireMessage({ kind: 'totally_bogus', data: 'garbage' })

    const stateAfter = JSON.stringify(sim.getCommittedState('server'))
    expect(stateAfter).toBe(stateBefore)
    sim.destroy()
  })
})

// ─── Consensus Authority ─────────────────────────────────────────────

describe('Cheating: Consensus Authority', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('forged vote — pre-injected REJECT frames peer as bad actor', () => {
    const sim = createConsensusSim()

    const forged = sim.forgeCommand(
      'player-x',
      { type: 'PLACE_MARK', payload: { cell: 4, player: 'X' } },
      { id: 'framed-cmd' },
    )

    sim.pauseDelivery()

    sim.injectWireMessage({
      kind: 'vote',
      vote: { commandId: 'framed-cmd', from: 'player-x', vote: 'REJECT' },
    })

    sim.injectWireMessage({
      kind: 'command',
      command: forged,
      events: [
        { type: 'MARK_PLACED', payload: { cell: 4, player: 'X', seq: 1 } },
      ],
    })

    sim.resumeDelivery()

    expect(board(sim.getCommittedState('worker'))[4]).toBe('X')

    const badActors = sim.getBadActorLog()
    const framed = badActors.filter((e) => e.peerId === 'player-x')
    expect(framed.length).toBeGreaterThan(0)

    sim.destroy()
  })

  it('tampered proposed events — interceptor changes events in command broadcast', () => {
    const sim = createConsensusSim()

    sim.setMessageInterceptor((_topic, payload) => {
      const msg = payload as Record<string, unknown>
      if (msg['kind'] === 'command') {
        const events = msg['events'] as Array<Record<string, unknown>>
        return {
          ...msg,
          events: events.map((e) => {
            if (e['type'] === 'MARK_PLACED') {
              const p = e['payload'] as Record<string, unknown>
              return { ...e, payload: { ...p, cell: 7 } }
            }
            return e
          }),
        }
      }
      return payload
    })

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'X' },
    })
    sim.setMessageInterceptor(null)

    const xBoard = board(sim.getCommittedState('player-x'))
    const oBoard = board(sim.getCommittedState('player-o'))

    expect(xBoard[4]).toBe('X')

    const oHasTampered = oBoard[7] === 'X'
    const oHasOriginal = oBoard[4] === 'X'
    expect(oHasTampered || oHasOriginal).toBe(true)

    sim.destroy()
  })

  it('phantom command — injected vote for non-existent command is buffered', () => {
    const sim = createConsensusSim()

    const stateBefore = JSON.stringify(sim.getCommittedState('player-x'))

    sim.injectWireMessage({
      kind: 'vote',
      vote: {
        commandId: 'phantom-cmd-999',
        from: 'player-o',
        vote: 'ACK',
      },
    })

    const stateAfter = JSON.stringify(sim.getCommittedState('player-x'))
    expect(stateAfter).toBe(stateBefore)
    sim.destroy()
  })

  it('bad actor detection — ACK on invalid command flags cheater', () => {
    const sim = createConsensusSim()

    const forged = sim.forgeCommand(
      'player-x',
      { type: 'PLACE_MARK', payload: { cell: -1, player: 'X' } },
      { id: 'bad-cmd', fakePeerId: 'player-x' },
    )

    sim.pauseDelivery()

    sim.injectWireMessage({
      kind: 'vote',
      vote: { commandId: 'bad-cmd', from: 'player-x', vote: 'ACK' },
    })

    sim.injectWireMessage({
      kind: 'command',
      command: forged,
      events: [
        { type: 'MARK_PLACED', payload: { cell: -1, player: 'X', seq: 1 } },
      ],
    })

    sim.resumeDelivery()

    const badActors = sim.getBadActorLog()
    const cheater = badActors.filter((e) => e.peerId === 'player-x')
    expect(cheater.length).toBeGreaterThan(0)

    sim.destroy()
  })

  it('command injection — inject fake command, peers validate and commit', () => {
    const sim = createConsensusSim()

    const forged = sim.forgeCommand(
      'player-x',
      { type: 'PLACE_MARK', payload: { cell: 4, player: 'X' } },
      { fakePeerId: 'external' },
    )

    sim.injectWireMessage({
      kind: 'command',
      command: forged,
      events: [
        { type: 'MARK_PLACED', payload: { cell: 4, player: 'X', seq: 1 } },
      ],
    })

    expect(board(sim.getCommittedState('player-o'))[4]).toBe('X')
    expect(board(sim.getCommittedState('worker'))[4]).toBe('X')
    sim.destroy()
  })
})

// ─── Cross-cutting ───────────────────────────────────────────────────

describe('Cheating: Cross-cutting', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('flood attack — rapid-fire dispatches, no crash', () => {
    const sim = createServerSim()

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

    const state = sim.getCommittedState('server')
    expect(state['board']).toBeDefined()
    expect(state['status']).toBeDefined()
    sim.destroy()
  })

  it('disconnect + cheat — inject messages while peer offline', () => {
    const sim = createServerSim()

    sim.disconnectPeer('player-o')

    sim.injectWireMessage({
      kind: 'committed',
      commandId: 'offline-cheat-1',
      events: [
        { type: 'MARK_PLACED', payload: { cell: 0, player: 'X', seq: 1 } },
      ],
    })

    expect(board(sim.getCommittedState('server'))[0]).toBe('X')
    expect(board(sim.getCommittedState('player-o'))[0]).toBeNull()

    sim.reconnectPeer('player-o')

    expect(board(sim.getCommittedState('player-o'))[0]).toBe('X')
    sim.destroy()
  })

  it('interceptor drop all — causes timeout on pending commands', () => {
    const sim = createServerSim({ consensusTimeoutMs: 3000 })

    sim.setMessageInterceptor(() => null)

    sim.dispatch('player-x', {
      type: 'PLACE_MARK',
      payload: { cell: 4, player: 'X' },
    })

    expect(board(sim.getState('player-x'))[4]).toBe('X')
    expect(board(sim.getCommittedState('player-x'))[4]).toBeNull()

    sim.advanceTime(3001)

    expect(board(sim.getState('player-x'))[4]).toBeNull()
    expect(sim.getTimeoutLog().length).toBe(1)

    sim.setMessageInterceptor(null)
    sim.destroy()
  })

  it('convergence after cheating — honest peers converge after junk injection', () => {
    const sim = createServerSim()

    sim.injectWireMessage({ kind: 'totally_bogus', data: [1, 2, 3] })
    sim.injectWireMessage({ kind: 'unknown', commandId: 'fake' })

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

    sim.assertConverged()

    const serverBoard = board(sim.getCommittedState('server'))
    expect(serverBoard[0]).toBe('X')
    expect(serverBoard[3]).toBe('O')
    expect(serverBoard[1]).toBe('X')
    sim.destroy()
  })

  it('forgeCommand utility — produces command with overridden fields', () => {
    const sim = createServerSim()

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
