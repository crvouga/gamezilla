import { useCallback, useRef } from 'react';
import { PlaceMark } from '@gamezilla/peer-store/testing/tic-tac-toe';
import type { PeerId, PlaygroundSimulator } from '../simulator/playground';

function isPeerId(value: string): value is PeerId {
  return (
    value === 'player-x' ||
    value === 'player-o' ||
    value === 'server' ||
    value === 'observer'
  );
}

export type PeerHandlers = {
  disconnectedPeers: React.MutableRefObject<Set<string>>;
  dispatch: (peerId: PeerId, cell: number) => void;
  disconnect: (peerId: string) => void;
  reconnect: (peerId: string) => void;
};

export function usePeerHandlers(sim: PlaygroundSimulator): PeerHandlers {
  const disconnectedPeers = useRef(new Set<string>());

  const dispatch = useCallback(
    (peerId: PeerId, cell: number) => {
      const player = peerId === 'player-x' ? 'X' : 'O';
      try {
        sim.dispatchWithSpoof(
          peerId,
          PlaceMark({ cell, player: player as 'X' | 'O' }),
        );
      } catch {
        /* error logged via onError callback */
      }
    },
    [sim],
  );

  const disconnect = useCallback(
    (peerId: string) => {
      if (!isPeerId(peerId)) return;
      try {
        sim.disconnectPeer(peerId);
        disconnectedPeers.current.add(peerId);
      } catch {
        /* already disconnected */
      }
    },
    [sim],
  );

  const reconnect = useCallback(
    (peerId: string) => {
      if (!isPeerId(peerId)) return;
      try {
        sim.reconnectPeer(peerId);
        disconnectedPeers.current.delete(peerId);
      } catch {
        /* not disconnected */
      }
    },
    [sim],
  );

  return { disconnectedPeers, dispatch, disconnect, reconnect };
}
