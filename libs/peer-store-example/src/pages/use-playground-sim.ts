import { useCallback, useRef, useSyncExternalStore } from 'react';
import { PlaygroundSimulator } from '../simulator/playground';

export function usePlaygroundSim(): {
  sim: PlaygroundSimulator;
  tick: number;
} {
  const simRef = useRef<PlaygroundSimulator | null>(null);
  if (!simRef.current) {
    simRef.current = new PlaygroundSimulator();
  }
  const sim = simRef.current;

  const versionRef = useRef(0);
  const tick = useSyncExternalStore(
    useCallback(
      (cb) =>
        sim.subscribe(() => {
          versionRef.current += 1;
          cb();
        }),
      [sim],
    ),
    useCallback(() => versionRef.current, []),
  );

  return { sim, tick };
}
