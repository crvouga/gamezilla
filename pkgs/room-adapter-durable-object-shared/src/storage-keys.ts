import type { Keyword } from '@pkgs/keyword-shared/keyword';
import { asKeyword } from '@pkgs/keyword-shared/keyword';
import type { RoomModuleName } from '@pkgs/room-root-shared/types';

/** Zero-pad seq so event keys sort lexicographically with numeric order. */
export const SEQ_KEY_PAD = 16;

/** Max keys per multi-`put` / multi-`delete` on DO storage. */
export const DO_KV_MULTI_KEY_LIMIT = 128;

export type RoomDoKeyNs = {
  /** Tiny `{ lastSeq }` record. */
  meta: string;
  /** Topic string for this module (needed for alarm wake without sockets). */
  topic: string;
  /** Prefix for `list({ prefix })` over committed events. */
  eventPrefix: string;
  /** Prefix for per-command dedup outcomes. */
  dedupPrefix: string;
  /** Prefix for pending Schedule entries (`{ at, payload }`). */
  schedulePrefix: string;
  /** Monolithic v2 blob (Keyword-shaped for historical continuity). */
  legacyBlob: Keyword;
};

/**
 * Per-module key namespace for DO room persistence.
 * v3 stores one KV value per event / dedup outcome (SQLite row ≤ 2 MB).
 * Event/dedup keys are plain strings (command ids are not kebab Keywords).
 */
export function roomDoKeyNs(moduleName?: RoomModuleName): RoomDoKeyNs {
  const scope = moduleName !== undefined ? String(moduleName) : '_';
  const base = `room.do.v3.${scope}`;
  const legacy =
    moduleName !== undefined
      ? asKeyword(`room.do/state-v2-${String(moduleName)}`)
      : asKeyword('room.do/state-v2');
  return {
    meta: `${base}.meta`,
    topic: `${base}.topic`,
    eventPrefix: `${base}.e.`,
    dedupPrefix: `${base}.d.`,
    schedulePrefix: `${base}.s.`,
    legacyBlob: legacy,
  };
}

export function eventKey(ns: RoomDoKeyNs, seq: number): string {
  return `${ns.eventPrefix}${String(seq).padStart(SEQ_KEY_PAD, '0')}`;
}

export function dedupKey(ns: RoomDoKeyNs, commandId: string): string {
  return `${ns.dedupPrefix}${commandId}`;
}

export function scheduleKey(ns: RoomDoKeyNs, scheduleId: string): string {
  return `${ns.schedulePrefix}${scheduleId}`;
}
