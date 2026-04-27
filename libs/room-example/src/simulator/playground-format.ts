import type { Event, State } from '@gamezilla/room/types';
import type { LogEntry, PeerId } from './playground-types';
import { TRUST_MAP, PEERS } from './playground-types';

export type AuthorityChange = {
  previousAuthority: string;
  newAuthority: string;
};

export type FormatLogInput = {
  entries: LogEntry[];
  errors: Array<{ type: string; payload: unknown }>;
  authorityChanges: AuthorityChange[];
  finalStates: Record<PeerId, State>;
  serverEvents: Event[];
};

function writeHeader(lines: string[]): void {
  lines.push('## Room Playground Session');
  lines.push('');
  lines.push('Setup:');
  lines.push(`  peers: ${JSON.stringify(TRUST_MAP)}`);
  lines.push('  module: TicTacToeModule');
  lines.push('');
  lines.push('Steps:');
}

function writeStepCode(lines: string[], prefix: string, code: string): void {
  const codeLines = code.split('\n');
  if (codeLines.length === 1) {
    lines.push(`${prefix} ${code}`);
    return;
  }
  lines.push(`${prefix} ${codeLines[0]}`);
  for (let i = 1; i < codeLines.length; i++) {
    lines.push(`     ${codeLines[i]}`);
  }
}

function writeStep(lines: string[], step: number, entry: LogEntry): void {
  const prefix = `  ${step}.`;
  if (entry.code) {
    writeStepCode(lines, prefix, entry.code);
  } else {
    lines.push(`${prefix} // ${entry.summary}`);
  }
  if (entry.kind === 'cheat') {
    const status = entry.detected ? 'CAUGHT' : 'UNDETECTED';
    lines.push(`     // → [${status}] ${entry.summary}`);
  }
}

function writeSteps(lines: string[], entries: LogEntry[]): void {
  let step = 0;
  for (const entry of entries) {
    step++;
    writeStep(lines, step, entry);
  }
}

function writeErrors(
  lines: string[],
  errors: Array<{ type: string; payload: unknown }>,
): void {
  lines.push('');
  lines.push('Errors:');
  if (errors.length === 0) {
    lines.push('  (none)');
    return;
  }
  for (const err of errors) {
    lines.push(
      `  - { type: '${err.type}', payload: ${JSON.stringify(err.payload)} }`,
    );
  }
}

function writeAuthorityChanges(
  lines: string[],
  changes: AuthorityChange[],
): void {
  if (changes.length === 0) return;
  lines.push('');
  lines.push('Authority changes:');
  for (const change of changes) {
    lines.push(`  - ${change.previousAuthority} → ${change.newAuthority}`);
  }
}

function writeFinalStates(
  lines: string[],
  states: Record<PeerId, State>,
): void {
  lines.push('');
  lines.push('Final states:');
  for (const peerId of PEERS) {
    lines.push(`  ${peerId}: ${JSON.stringify(states[peerId])}`);
  }
}

function writeCommittedEvents(lines: string[], events: Event[]): void {
  lines.push('');
  lines.push('Committed events (server):');
  if (events.length === 0) {
    lines.push('  (none)');
    return;
  }
  for (const ev of events) {
    lines.push(`  - ${ev.type} ${JSON.stringify(ev.payload)}`);
  }
}

export function formatLogForClipboard(input: FormatLogInput): string {
  const lines: string[] = [];
  writeHeader(lines);
  writeSteps(lines, input.entries);
  writeErrors(lines, input.errors);
  writeAuthorityChanges(lines, input.authorityChanges);
  writeFinalStates(lines, input.finalStates);
  writeCommittedEvents(lines, input.serverEvents);
  return lines.join('\n');
}
