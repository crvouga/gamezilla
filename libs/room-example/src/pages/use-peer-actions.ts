import type { State } from '@gamezilla/room/types';
import type { MutableRefObject } from 'react';
import { useMemo } from 'react';
import type { PeerAction } from '../components/peer-panel-actions';
import type { PeerId, PlaygroundSimulator } from '../simulator/playground';

function inProgress(state: State): boolean {
  return state['status'] === 'in_progress';
}

function buildSpoofAction(
  sim: PlaygroundSimulator,
  peerId: PeerId,
  visible: boolean,
): PeerAction {
  const other = peerId === 'player-x' ? 'O' : 'X';
  const isOn = sim.isSpoofing(peerId);
  return {
    label: isOn ? `Spoofing ${other}` : `Spoof as ${other}`,
    color: 'destructive',
    active: isOn,
    visible,
    onPress: () => sim.toggleSpoof(peerId),
  };
}

function buildFloodAction(
  sim: PlaygroundSimulator,
  peerId: PeerId,
  visible: boolean,
): PeerAction {
  return {
    label: 'Flood',
    color: 'destructive',
    visible,
    onPress: () => {
      try {
        sim.cheatFlood(peerId);
      } catch {
        /* logged */
      }
    },
  };
}

export function usePeerActions(
  sim: PlaygroundSimulator,
  tick: number,
  disconnectedPeers: MutableRefObject<Set<string>>,
): Record<PeerId, PeerAction[]> {
  return useMemo<Record<PeerId, PeerAction[]>>(
    () => {
      const makePeerActions = (peerId: 'player-x' | 'player-o'): PeerAction[] => {
        const online = !disconnectedPeers.current.has(peerId);
        const state = sim.getState(peerId);
        const visible = online && inProgress(state);
        return [
          buildFloodAction(sim, peerId, visible),
          buildSpoofAction(sim, peerId, visible),
        ];
      };
      return {
        'player-x': makePeerActions('player-x'),
        'player-o': makePeerActions('player-o'),
        server: [],
      };
    },
    [sim, tick, disconnectedPeers],
  );
}
