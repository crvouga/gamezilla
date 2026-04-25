import { useCallback, useState } from 'react';
import type { PlaygroundSimulator } from '../simulator/playground';

export type CheatHandlers = {
  fabricate: () => void;
  replay: () => void;
  tamper: () => void;
  clearTamper: () => void;
  unauthorizedTrustX: () => void;
  unauthorizedTrustO: () => void;
  forcedClockX: () => void;
  forcedClockO: () => void;
  tamperActive: boolean;
};

export function useCheatHandlers(sim: PlaygroundSimulator): CheatHandlers {
  const [tamperActive, setTamperActive] = useState(false);

  const fabricate = useCallback(() => {
    try {
      sim.cheatFabricateCommit();
    } catch {
      /* logged */
    }
  }, [sim]);

  const replay = useCallback(() => {
    try {
      sim.cheatReplay();
    } catch {
      /* logged */
    }
  }, [sim]);

  const tamper = useCallback(() => {
    try {
      sim.cheatTamperEvents();
      setTamperActive(true);
    } catch {
      /* logged */
    }
  }, [sim]);

  const clearTamper = useCallback(() => {
    try {
      sim.cheatClearInterceptor();
      setTamperActive(false);
    } catch {
      /* logged */
    }
  }, [sim]);

  const unauthorizedTrustX = useCallback(() => {
    sim.cheatUnauthorizedTrustUpdate('player-x');
  }, [sim]);

  const unauthorizedTrustO = useCallback(() => {
    sim.cheatUnauthorizedTrustUpdate('player-o');
  }, [sim]);

  const forcedClockX = useCallback(() => {
    sim.cheatForceClockTick('player-x', 7000);
  }, [sim]);

  const forcedClockO = useCallback(() => {
    sim.cheatForceClockTick('player-o', 7000);
  }, [sim]);

  return {
    fabricate,
    replay,
    tamper,
    clearTamper,
    unauthorizedTrustX,
    unauthorizedTrustO,
    forcedClockX,
    forcedClockO,
    tamperActive,
  };
}
