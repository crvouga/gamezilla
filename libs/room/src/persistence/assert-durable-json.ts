import { Assert } from '@gamezilla/lib/assert';
import type { LogEntry } from './log-entry'
import type { Command, Snapshot, State } from '../room/types'
import type { Event, Message } from '../events/message-types'

const crash: Assert = Assert.crash();

function assertMessage(value: unknown): Message {
  crash.record(value, 'message must be a plain object');
  const type = value['type'];
  crash.string(type, 'message.type must be string');
  return { type, payload: value['payload'] };
}

/** Validates JSON-shaped command rows from persistence journals or wire. */
export function assertCommand(value: unknown): Command {
  crash.record(value, 'command must be a plain object');
  const id = value['id'];
  crash.nonEmptyString(id, 'command.id must be non-empty');
  const seq = value['seq'];
  crash.nonNegativeInteger(seq, 'command.seq must be a non-negative integer');
  const peerId = value['peerId'];
  crash.nonEmptyString(peerId, 'command.peerId must be non-empty');
  const message = value['message'];
  return { id, seq, peerId, message: assertMessage(message) };
}

function assertEvent(value: unknown): Event {
  crash.record(value, 'event must be a plain object');
  const type = value['type'];
  crash.string(type, 'event.type must be string');
  return { type, payload: value['payload'] };
}

export function assertLogEntry(value: unknown): LogEntry {
  crash.record(value, 'log entry must be a plain object');
  const seq = value['seq'];
  crash.number(seq, 'log entry.seq must be a finite number');
  const event = value['event'];
  return { seq, event: assertEvent(event) };
}

export function assertLogEntryArray(value: unknown): LogEntry[] {
  crash.array(value, 'committed entries must be an array');
  const out: LogEntry[] = [];
  for (const row of value) {
    out.push(assertLogEntry(row));
  }
  return out;
}

export function assertState(value: unknown): State {
  crash.record(value, 'state must be a plain object');
  return value;
}

export function assertMembershipRecord(value: unknown): Record<string, number> {
  crash.record(value, 'membership must be a plain object');
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value)) {
    crash.number(v, `membership trust for ${k} must be a finite number`);
    out[k] = v;
  }
  return out;
}

export function assertSnapshot(value: unknown): Snapshot {
  crash.record(value, 'snapshot must be a plain object');
  const seq = value['seq'];
  crash.number(seq, 'snapshot.seq must be a finite number');
  return {
    seq,
    domainState: assertState(value['domainState']),
    membership: assertMembershipRecord(value['membership']),
  };
}
