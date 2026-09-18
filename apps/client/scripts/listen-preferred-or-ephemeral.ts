#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Bind `preferredPort`, or an ephemeral OS port when that address is in use.
 * Lets parallel CI processes share preferred defaults without colliding.
 */

export function isAddrInUse(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = 'code' in err ? err.code : undefined;
  return code === 'EADDRINUSE';
}

export type ListenPreferredResult = {
  readonly server: ReturnType<typeof Bun.serve>;
  readonly port: number;
};

export function listenPreferredOrEphemeral(args: {
  readonly preferredPort: number;
  readonly fetch: (req: Request) => Response | Promise<Response>;
}): ListenPreferredResult {
  try {
    return boundResult(
      Bun.serve({
        port: args.preferredPort,
        fetch: args.fetch,
      })
    );
  } catch (err) {
    if (!isAddrInUse(err)) throw err;
    return boundResult(
      Bun.serve({
        port: 0,
        fetch: args.fetch,
      })
    );
  }
}

/** `Bun.serve` types `port` as optional (unix sockets); this helper always binds TCP. */
function boundResult(
  server: ReturnType<typeof Bun.serve>
): ListenPreferredResult {
  if (server.port === undefined) {
    throw new Error('Bun.serve did not bind a TCP port');
  }
  return { server, port: server.port };
}
