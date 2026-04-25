import { useCallback } from 'react';
import type { PlaygroundSimulator } from '../simulator/playground';

export type CheatHandlers = {
  fabricate: () => void;
  replay: () => void;
  tamper: () => void;
  clearTamper: () => void;
};

export function useCheatHandlers(sim: PlaygroundSimulator): CheatHandlers {
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
    } catch {
      /* logged */
    }
  }, [sim]);

  const clearTamper = useCallback(() => {
    try {
      sim.cheatClearInterceptor();
    } catch {
      /* logged */
    }
  }, [sim]);

  return { fabricate, replay, tamper, clearTamper };
}
