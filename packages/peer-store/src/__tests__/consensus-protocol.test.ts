import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Assert } from '@gamezilla/shared/assert'
import { ValidationError } from '@gamezilla/shared/assert/validation-error'
import { ConsensusProtocol } from '../consensus-protocol'
import { TestCrashHandler } from './test-crash-handler'

let disposeCrashHandler: () => void
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler())
})
afterAll(() => disposeCrashHandler())

describe('ConsensusProtocol', () => {
  const PEERS = ['alice', 'bob', 'carol']

  it('2 ACKs of 3 → COMMITTED', () => {
    const cp = new ConsensusProtocol(PEERS)
    expect(cp.record({ commandId: 'c1', from: 'alice', vote: 'ACK' })).toEqual({
      status: 'PENDING',
    })
    expect(cp.record({ commandId: 'c1', from: 'bob', vote: 'ACK' })).toEqual({
      status: 'COMMITTED',
    })
  })

  it('2 REJECTs of 3 → REJECTED with bad actor identified', () => {
    const cp = new ConsensusProtocol(PEERS)
    cp.record({ commandId: 'c1', from: 'alice', vote: 'ACK' })
    cp.record({ commandId: 'c1', from: 'bob', vote: 'REJECT' })
    const result = cp.record({ commandId: 'c1', from: 'carol', vote: 'REJECT' })
    expect(result).toEqual({
      status: 'REJECTED',
      badActors: ['alice'],
    })
  })

  it('1 ACK 1 REJECT → PENDING', () => {
    const cp = new ConsensusProtocol(PEERS)
    cp.record({ commandId: 'c1', from: 'alice', vote: 'ACK' })
    expect(cp.record({ commandId: 'c1', from: 'bob', vote: 'REJECT' })).toEqual({
      status: 'PENDING',
    })
  })

  it('all 3 ACK → COMMITTED', () => {
    const cp = new ConsensusProtocol(PEERS)
    cp.record({ commandId: 'c1', from: 'alice', vote: 'ACK' })
    const result = cp.record({ commandId: 'c1', from: 'bob', vote: 'ACK' })
    expect(result.status).toBe('COMMITTED')
    expect(cp.isResolved('c1')).toBe(true)
  })

  it('recording on frozen commandId → crash', () => {
    const cp = new ConsensusProtocol(PEERS)
    cp.record({ commandId: 'c1', from: 'alice', vote: 'ACK' })
    cp.record({ commandId: 'c1', from: 'bob', vote: 'ACK' })
    expect(() =>
      cp.record({ commandId: 'c1', from: 'carol', vote: 'ACK' }),
    ).toThrow('already resolved')
  })

  it('getBadActors on unresolved commandId → crash', () => {
    const cp = new ConsensusProtocol(PEERS)
    cp.record({ commandId: 'c1', from: 'alice', vote: 'ACK' })
    expect(() => cp.getBadActors('c1')).toThrow('not resolved')
  })

  it('getBadActors returns empty array when all voted same', () => {
    const cp = new ConsensusProtocol(PEERS)
    cp.record({ commandId: 'c1', from: 'alice', vote: 'ACK' })
    cp.record({ commandId: 'c1', from: 'bob', vote: 'ACK' })
    expect(cp.getBadActors('c1')).toEqual([])
  })

  it('getBadActors returns REJECT voters on COMMITTED outcome', () => {
    const cp = new ConsensusProtocol(PEERS)
    cp.record({ commandId: 'c1', from: 'alice', vote: 'ACK' })
    cp.record({ commandId: 'c1', from: 'bob', vote: 'REJECT' })
    cp.record({ commandId: 'c1', from: 'carol', vote: 'ACK' })
    expect(cp.getBadActors('c1')).toEqual(['bob'])
  })

  it('custom quorum 3 of 3 requires unanimous', () => {
    const cp = new ConsensusProtocol(PEERS, 3)
    cp.record({ commandId: 'c1', from: 'alice', vote: 'ACK' })
    cp.record({ commandId: 'c1', from: 'bob', vote: 'ACK' })
    expect(cp.isResolved('c1')).toBe(false)
    expect(cp.record({ commandId: 'c1', from: 'carol', vote: 'ACK' })).toEqual({
      status: 'COMMITTED',
    })
  })

  it('duplicate vote from same peer: last vote wins', () => {
    const cp = new ConsensusProtocol(PEERS)
    cp.record({ commandId: 'c1', from: 'alice', vote: 'ACK' })
    cp.record({ commandId: 'c1', from: 'alice', vote: 'REJECT' })
    const result = cp.record({ commandId: 'c1', from: 'bob', vote: 'REJECT' })
    expect(result.status).toBe('REJECTED')
    expect(cp.getBadActors('c1')).toEqual([])
  })

  it('reset allows commandId to be re-resolved', () => {
    const cp = new ConsensusProtocol(PEERS)
    cp.record({ commandId: 'c1', from: 'alice', vote: 'ACK' })
    cp.record({ commandId: 'c1', from: 'bob', vote: 'ACK' })
    expect(cp.isResolved('c1')).toBe(true)
    cp.reset('c1')
    expect(cp.isResolved('c1')).toBe(false)
    const result = cp.record({ commandId: 'c1', from: 'carol', vote: 'ACK' })
    expect(result.status).toBe('PENDING')
  })

  it('constructor with 1 peer → crash', () => {
    expect(() => new ConsensusProtocol(['solo'])).toThrow('at least 2 peers')
  })

  it('constructor with duplicate peer ids → crash', () => {
    expect(() => new ConsensusProtocol(['a', 'a', 'b'])).toThrow('duplicate')
  })

  it('constructor with quorum > peers.length → crash', () => {
    expect(() => new ConsensusProtocol(['a', 'b'], 5)).toThrow('quorum')
  })

  it('constructor with quorum = 0 → crash', () => {
    expect(() => new ConsensusProtocol(['a', 'b'], 0)).toThrow('quorum')
  })

  it('record with unknown peer → validation error', () => {
    const cp = new ConsensusProtocol(PEERS)
    expect(() =>
      cp.record({ commandId: 'c1', from: 'unknown', vote: 'ACK' }),
    ).toThrow(ValidationError)
  })

  it('record with invalid vote value → validation error', () => {
    const cp = new ConsensusProtocol(PEERS)
    expect(() =>
      cp.record({ commandId: 'c1', from: 'alice', vote: 'MAYBE' as 'ACK' }),
    ).toThrow(ValidationError)
  })
})
