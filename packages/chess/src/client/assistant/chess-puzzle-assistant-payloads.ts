/**
 * Stable payload refs + registry for {@link getChessPuzzleAssistantMessage}.
 */
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { ChessPuzzleTheme } from '../../shared/chess-puzzle-themes';

import {
  FALLBACK_ENTRIES,
  PROGRESS_ENTRIES,
  RETRY_ENTRIES,
  SOLVED_ENTRIES,
  START_ENTRIES,
  WRONG_ENTRIES,
} from './chess-puzzle-assistant-payload-rows';

type ThemedEntry = readonly [ChessPuzzleTheme, MessageDescriptor];

type PayloadRow = {
  readonly ref: string;
  readonly key: string;
  readonly message: MessageDescriptor;
};

function buildKeyedRefs(
  prefix: string,
  rows: readonly (readonly [string, MessageDescriptor])[]
): readonly PayloadRow[] {
  const counts = new Map<string, number>();
  const out: PayloadRow[] = [];
  for (const [key, message] of rows) {
    const n = counts.get(key) ?? 0;
    counts.set(key, n + 1);
    const ref = `assistant.chess.puzzle.${prefix}.${key}.${n}`;
    out.push({ ref, key, message });
  }
  return out;
}

const ANNOUNCE_ENTRIES: readonly ThemedEntry[] = [
  ['mateIn1', msg`This one is mate in one — find the winning blow.`],
  ['mateIn2', msg`Mate in two. Take your time on the first move.`],
  ['mateIn3', msg`Mate in three. Build your idea step by step.`],
  ['mateIn4', msg`Mate in four. Stay sharp through the line.`],
  ['mateIn5', msg`Mate in five — deep but doable.`],
  ['mate', msg`There's a checkmate in this position.`],
];

const START_ROWS = buildKeyedRefs('start', START_ENTRIES);
const PROGRESS_ROWS = buildKeyedRefs('progress', PROGRESS_ENTRIES);
const WRONG_ROWS = buildKeyedRefs('wrong', WRONG_ENTRIES);
const RETRY_ROWS = buildKeyedRefs('retry', RETRY_ENTRIES);
const SOLVED_ROWS = buildKeyedRefs('solved', SOLVED_ENTRIES);
const FALLBACK_ROWS = buildKeyedRefs('fallback', FALLBACK_ENTRIES);
const ANNOUNCE_ROWS = buildKeyedRefs('announce', ANNOUNCE_ENTRIES);

const CHESS_PUZZLE_PAYLOAD_REGISTRY = new Map<string, MessageDescriptor>();

function ingest(rows: readonly PayloadRow[]): void {
  for (const r of rows) {
    CHESS_PUZZLE_PAYLOAD_REGISTRY.set(r.ref, r.message);
  }
}

ingest(START_ROWS);
ingest(PROGRESS_ROWS);
ingest(WRONG_ROWS);
ingest(RETRY_ROWS);
ingest(SOLVED_ROWS);
ingest(FALLBACK_ROWS);
ingest(ANNOUNCE_ROWS);

function groupByKey(
  rows: readonly PayloadRow[]
): ReadonlyMap<string, readonly string[]> {
  const m = new Map<string, string[]>();
  for (const r of rows) {
    const arr = m.get(r.key) ?? [];
    arr.push(r.ref);
    m.set(r.key, arr);
  }
  return m;
}

export const CHESS_PUZZLE_START_REFS_BY_THEME = groupByKey(START_ROWS);
export const CHESS_PUZZLE_PROGRESS_REFS_BY_THEME = groupByKey(PROGRESS_ROWS);
export const CHESS_PUZZLE_WRONG_REFS_BY_THEME = groupByKey(WRONG_ROWS);
export const CHESS_PUZZLE_RETRY_REFS_BY_THEME = groupByKey(RETRY_ROWS);
export const CHESS_PUZZLE_SOLVED_REFS_BY_THEME = groupByKey(SOLVED_ROWS);
export const CHESS_PUZZLE_ANNOUNCE_REFS_BY_THEME = groupByKey(ANNOUNCE_ROWS);

const FALLBACK_REFS_BY_EVENT = groupByKey(FALLBACK_ROWS);

export function getChessPuzzleAssistantMessage(
  ref: string
): MessageDescriptor | undefined {
  return CHESS_PUZZLE_PAYLOAD_REGISTRY.get(ref);
}

export function chessPuzzleFallbackRefs(event: string): readonly string[] {
  return FALLBACK_REFS_BY_EVENT.get(event) ?? [];
}
