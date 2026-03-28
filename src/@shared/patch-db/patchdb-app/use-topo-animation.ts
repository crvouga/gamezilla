import { useCallback } from 'react';
import type { PlaygroundClientHandle, PlaygroundSim } from '../sim/playground-sim';
import type { TopoAnimHandle } from './playground-topology-graph';
import { SERVER_NODE_ID } from './constants';

/**
 * Returns a callback that animates server -> all connected clients
 * (used after server-side mutations so clients see the poll response).
 */
export function useServerTopoAnimation(
  sim: PlaygroundSim,
  topoRef: React.RefObject<TopoAnimHandle | null>
) {
  return useCallback(() => {
    if (sim.isServerPartitioned()) return;
    for (const c of sim.clients) {
      if (c.link.isPartitioned()) continue;
      topoRef.current?.animateMessage(SERVER_NODE_ID, c.id, c.link.getLatency());
    }
  }, [sim, topoRef]);
}

/**
 * Returns a callback that animates client -> server, then (after a delay)
 * server -> all connected clients (push + broadcast fan-out).
 */
export function useClientTopoAnimation(
  client: PlaygroundClientHandle,
  sim: PlaygroundSim,
  topoRef: React.RefObject<TopoAnimHandle | null>
) {
  return useCallback(() => {
    if (sim.isServerPartitioned()) return;
    const pushLatency = client.link.getLatency();
    if (!client.link.isPartitioned()) {
      topoRef.current?.animateMessage(client.id, SERVER_NODE_ID, pushLatency);
    }
    const pollDelay = Math.max(pushLatency, 150);
    setTimeout(() => {
      if (sim.isServerPartitioned()) return;
      for (const c of sim.clients) {
        if (c.link.isPartitioned()) continue;
        topoRef.current?.animateMessage(
          SERVER_NODE_ID,
          c.id,
          c.link.getLatency()
        );
      }
    }, pollDelay);
  }, [client.id, client.link, sim, topoRef]);
}
