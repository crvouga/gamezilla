import { useMemo } from 'react';
import type { LogEntry, PlaygroundSimulator } from '../simulator/playground';

export type DerivedState = {
  log: LogEntry[];
  badActorIds: Set<string | undefined>;
  cheaterIds: Set<string>;
};

export function useDerivedState(
  sim: PlaygroundSimulator,
  tick: number,
): DerivedState {
  const log = useMemo(() => sim.getLog(), [sim, tick]);

  const badActorIds = useMemo(
    () =>
      new Set(
        sim
          .getLog()
          .filter((e) => e.kind === 'cheat' && e.peerId)
          .map((e) => e.peerId),
      ),
    [tick, sim],
  );

  const cheaterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of log) {
      if (
        entry.kind === 'cheat' &&
        !entry.detected &&
        entry.peerId &&
        entry.peerId !== 'wire'
      ) {
        ids.add(entry.peerId);
      }
    }
    return ids;
  }, [log]);

  return { log, badActorIds, cheaterIds };
}
