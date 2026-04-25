import { useMemo } from 'react';
import type { PeerAction } from '../components/peer-panel-actions';
import type { PeerId, PlaygroundSimulator } from '../simulator/playground';

function buildSpoofAction(
  sim: PlaygroundSimulator,
  peerId: PeerId,
): PeerAction {
  const other = peerId === 'player-x' ? 'O' : 'X';
  const isOn = sim.isSpoofing(peerId);
  return {
    label: isOn ? `Spoofing ${other}` : `Spoof as ${other}`,
    color: 'destructive',
    active: isOn,
    onPress: () => sim.toggleSpoof(peerId),
  };
}

function buildFloodAction(
  sim: PlaygroundSimulator,
  peerId: PeerId,
): PeerAction {
  return {
    label: 'Flood',
    color: 'destructive',
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
): Record<PeerId, PeerAction[]> {
  return useMemo<Record<PeerId, PeerAction[]>>(
    () => ({
      'player-x': [
        buildFloodAction(sim, 'player-x'),
        buildSpoofAction(sim, 'player-x'),
      ],
      'player-o': [
        buildFloodAction(sim, 'player-o'),
        buildSpoofAction(sim, 'player-o'),
      ],
      server: [],
      observer: [],
    }),
    [sim, tick],
  );
}
