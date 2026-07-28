import type { RoomActor } from '@pkgs/room';

export type AttributionHit = {
  readonly actor: RoomActor;
  readonly seq: number;
  readonly ts: number;
};

/**
 * Pure projection: last actor per `targetKey` across projected log lines
 * (or any source that carries `targetKeys` + actor metadata).
 *
 * Walks entries in order so later events overwrite earlier ones for the
 * same key. Entries without an actor or without targetKeys are skipped.
 */
export function deriveAttribution(
  lines: readonly {
    readonly seq: number;
    readonly ts: number;
    readonly actor: RoomActor | null;
    readonly targetKeys?: readonly string[];
  }[]
): ReadonlyMap<string, AttributionHit> {
  const map = new Map<string, AttributionHit>();
  for (const line of lines) {
    if (line.actor === null) continue;
    const keys = line.targetKeys;
    if (keys === undefined || keys.length === 0) continue;
    const hit: AttributionHit = {
      actor: line.actor,
      seq: line.seq,
      ts: line.ts,
    };
    for (const key of keys) {
      map.set(key, hit);
    }
  }
  return map;
}
