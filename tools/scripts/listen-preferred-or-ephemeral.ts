#!/usr/bin/env bun
// @io-wall-ok — tools composition root
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
    const server = Bun.serve({
      port: args.preferredPort,
      fetch: args.fetch,
    });
    return { server, port: server.port };
  } catch (err) {
    if (!isAddrInUse(err)) throw err;
    const server = Bun.serve({
      port: 0,
      fetch: args.fetch,
    });
    return { server, port: server.port };
  }
}
