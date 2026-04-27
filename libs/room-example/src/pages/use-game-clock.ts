import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  PlaygroundSimulator,
  SimClockSnapshot,
} from '../simulator/playground';

export type GameClockControls = {
  snapshot: SimClockSnapshot;
  logicalTimeMs: number;
  realtimeEnabled: boolean;
  canEnableRealtime: boolean;
  startRealtime: () => void;
  stopRealtime: () => void;
  addOneSecond: () => void;
  addFiveSeconds: () => void;
};

export function useGameClock(
  sim: PlaygroundSimulator,
  tick: number,
): GameClockControls {
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const snapshot = useMemo(() => sim.getClockSnapshot('server'), [sim, tick]);
  const logicalTimeMs = useMemo(() => sim.getLogicalTimeMs(), [sim, tick]);
  const canEnableRealtime = snapshot.clockStatus === 'running';

  useEffect(() => {
    if (!canEnableRealtime && realtimeEnabled) {
      setRealtimeEnabled(false);
    }
  }, [canEnableRealtime, realtimeEnabled]);

  useEffect(() => {
    if (!realtimeEnabled) return;
    const id = setInterval(() => {
      try {
        sim.advanceTime(250, { silent: true });
      } catch {
        setRealtimeEnabled(false);
      }
    }, 250);
    return () => clearInterval(id);
  }, [sim, realtimeEnabled]);

  const startRealtime = useCallback(() => {
    if (!canEnableRealtime) return;
    setRealtimeEnabled(true);
  }, [canEnableRealtime]);

  const stopRealtime = useCallback(() => {
    setRealtimeEnabled(false);
  }, []);

  const addOneSecond = useCallback(() => {
    sim.advanceTime(1000);
  }, [sim]);

  const addFiveSeconds = useCallback(() => {
    sim.advanceTime(5000);
  }, [sim]);

  return {
    snapshot,
    logicalTimeMs,
    realtimeEnabled,
    canEnableRealtime,
    startRealtime,
    stopRealtime,
    addOneSecond,
    addFiveSeconds,
  };
}
