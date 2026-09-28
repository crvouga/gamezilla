// @io-wall-ok — probes the host's TCP ports for the broker process runner.
import { createServer } from 'node:net';

/**
 * EMQX derives two more listeners from the node name's numeric suffix `N`:
 * Erlang distribution on `4370 + N` and gen_rpc on `5370 + N` (`emqx7@…` →
 * 4377 and 5377). Two brokers with the same suffix cannot run on one host.
 */
const DIST_BASE_PORT = 4370;
const RPC_BASE_PORT = 5370;
const MAX_NODE_SUFFIX = 999;

export type EmqxIsolatedPorts = {
  readonly mqttPort: number;
  readonly wsPort: number;
  readonly dashboardPort: number;
  /** `emqx<N>@127.0.0.1` with its distribution and RPC ports free. */
  readonly nodeName: string;
};

function listenOn(port: number): Promise<number | null> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(null));
    server.listen({ port, host: '0.0.0.0', exclusive: true }, () => {
      const address = server.address();
      const bound =
        typeof address === 'object' && address ? address.port : null;
      server.close(() => resolve(bound));
    });
  });
}

async function ephemeralPort(): Promise<number> {
  const port = await listenOn(0);
  if (port === null) throw new Error('emqx: no free TCP port');
  return port;
}

async function freeNodeSuffix(start: number): Promise<number> {
  for (let i = 0; i < MAX_NODE_SUFFIX; i += 1) {
    const suffix = ((start + i) % MAX_NODE_SUFFIX) + 1;
    const dist = await listenOn(DIST_BASE_PORT + suffix);
    if (dist === null) continue;
    if ((await listenOn(RPC_BASE_PORT + suffix)) !== null) return suffix;
  }
  throw new Error('emqx: no free node suffix for distribution/RPC ports');
}

/**
 * Ports and a node name no other broker on this host holds, so a test broker
 * never collides with a dev stack or another worktree's run. `seed` picks
 * where the node-suffix search starts (pass the pid).
 */
export async function isolatedEmqxPorts(
  seed: number
): Promise<EmqxIsolatedPorts> {
  const suffix = await freeNodeSuffix(seed);
  const ports = new Set<number>();
  while (ports.size < 3) ports.add(await ephemeralPort());
  const [mqttPort = 0, wsPort = 0, dashboardPort = 0] = [...ports];
  return {
    mqttPort,
    wsPort,
    dashboardPort,
    nodeName: `emqx${String(suffix)}@127.0.0.1`,
  };
}
