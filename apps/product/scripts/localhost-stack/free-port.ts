// @io-wall-ok — tools composition root.

/**
 * OS-assigned ports and the readiness probes that follow them.
 *
 * Asking the kernel for port 0 and reading back what it gave is the only way
 * to allocate without a registry. Holding the socket until the moment the
 * real listener binds keeps two concurrent stacks from being handed the same
 * number, so the window is narrowed rather than merely hoped away.
 */

export type PortReservation = {
  readonly port: number;
  /** Release the placeholder listener so the real server can bind. */
  release(): Promise<void>;
};

export function reservePort(): PortReservation {
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch: () => new Response('reserved', { status: 503 }),
  });
  let released = false;
  return {
    port: Number(server.url.port),
    async release() {
      if (released) return;
      released = true;
      // Awaited, not fire-and-forget: the caller spawns the real listener
      // immediately after, and an open placeholder is a port collision.
      await server.stop(true);
    },
  };
}

async function waitForResponse(args: {
  readonly url: string;
  readonly init?: RequestInit;
  readonly timeoutMs: number;
  /** Statuses that mean ready; anything else keeps polling. */
  readonly accept: (status: number) => boolean;
  /** A response that will never become ready — throws with this message. */
  readonly failOn?: (response: Response, body: string) => string | null;
}): Promise<void> {
  const deadline = Date.now() + args.timeoutMs;
  let last = 'no response';
  while (Date.now() < deadline) {
    let response: Response | null = null;
    try {
      response = await fetch(args.url, args.init);
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    if (response !== null) {
      if (args.accept(response.status)) return;
      const body = await response.text();
      const fatal = args.failOn?.(response, body) ?? null;
      if (fatal !== null) throw new Error(fatal);
      last = `HTTP ${String(response.status)} ${body}`;
    }
    await Bun.sleep(150);
  }
  throw new Error(`timed out waiting for ${args.url}: ${last}`);
}

/**
 * Ready when the listener answers anything below 500 — a 503 from the
 * balancer means "a backend is not up yet", a normal state to wait through.
 */
export function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  return waitForResponse({ url, timeoutMs, accept: (status) => status < 500 });
}

/**
 * `/api/health` proves only that the listener bound: the API worker boots
 * lazily on the first real request, and a fatal misconfiguration answers 503
 * `api misconfigured` forever after. Send a real request so a stack that
 * cannot serve fails with the server's own reason instead of a bare timeout.
 */
export function waitForApiBooted(
  origin: string,
  timeoutMs = 90_000
): Promise<void> {
  return waitForResponse({
    url: `${origin}/api/query`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: [] }),
    },
    timeoutMs,
    accept: (status) => status !== 503,
    failOn: (_response, body) =>
      body.includes('api misconfigured')
        ? `${origin} failed to boot: ${body}`
        : null,
  });
}
