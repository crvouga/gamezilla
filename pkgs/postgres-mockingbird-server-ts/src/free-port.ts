// @io-wall-ok — probes the host's TCP ports for the cluster process runner.
import { createServer } from 'node:net';

/**
 * A TCP port nothing on this host listens on, for a throwaway cluster. The
 * contract suites each boot their own cluster, concurrently within one
 * `bun verify` and across worktrees; on the shared default port they bound
 * each other's cluster and hung when it stopped.
 */
export function freePostgresPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen({ port: 0, host: '127.0.0.1', exclusive: true }, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() =>
        port > 0 ? resolve(port) : reject(new Error('postgres: no free port'))
      );
    });
  });
}
