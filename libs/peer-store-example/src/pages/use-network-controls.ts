import { useCallback, useRef } from 'react';
import { PlaceMark } from '@gamezilla/peer-store/testing/tic-tac-toe';
import type { PlaygroundSimulator } from '../simulator/playground';

export type NetworkControls = {
  isPaused: React.MutableRefObject<boolean>;
  pause: () => void;
  resume: () => void;
  drop: () => void;
  advance: () => void;
  reset: () => void;
  scenarioPartition: () => void;
  scenarioTimeout: () => void;
};

export function useNetworkControls(
  sim: PlaygroundSimulator,
  disconnectedPeers: React.MutableRefObject<Set<string>>,
): NetworkControls {
  const isPaused = useRef(false);

  const pause = useCallback(() => {
    try {
      sim.pauseDelivery();
      isPaused.current = true;
    } catch {
      /* already paused */
    }
  }, [sim]);

  const resume = useCallback(() => {
    try {
      sim.resumeDelivery();
      isPaused.current = false;
    } catch {
      /* not paused */
    }
  }, [sim]);

  const drop = useCallback(() => {
    try {
      sim.dropNextMessage();
    } catch {
      /* no messages */
    }
  }, [sim]);

  const advance = useCallback(() => {
    try {
      sim.advanceTime(5001);
    } catch {
      /* ignore */
    }
  }, [sim]);

  const reset = useCallback(() => {
    sim.reset();
    disconnectedPeers.current.clear();
    isPaused.current = false;
  }, [sim, disconnectedPeers]);

  const scenarioPartition = useCallback(() => {
    reset();
    setTimeout(() => {
      sim.disconnectPeer('player-o');
      disconnectedPeers.current.add('player-o');
      sim.dispatch('player-x', PlaceMark({ cell: 4, player: 'X' }));
    }, 50);
  }, [sim, reset, disconnectedPeers]);

  const scenarioTimeout = useCallback(() => {
    reset();
    setTimeout(() => {
      sim.disconnectPeer('server');
      disconnectedPeers.current.add('server');
      sim.dispatch('player-x', PlaceMark({ cell: 0, player: 'X' }));
      try {
        sim.advanceTime(5001);
      } catch {
        /* ignore */
      }
    }, 50);
  }, [sim, reset, disconnectedPeers]);

  return {
    isPaused,
    pause,
    resume,
    drop,
    advance,
    reset,
    scenarioPartition,
    scenarioTimeout,
  };
}
