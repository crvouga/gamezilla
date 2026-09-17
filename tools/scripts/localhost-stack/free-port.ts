// @io-wall-ok — tools composition root.

/**
 * OS-assigned ports.
 *
 * Asking the kernel for port 0 and reading back what it gave is the only way
 * to allocate without a registry. Holding the socket until the moment the
 * real listener binds keeps two concurrent stacks from being handed the same
 * number, so the window is narrowed rather than merely hoped away.
 */

export type PortReservation = {
  readonly port: number;
  /** Release the placeholder listener so the real server can bind. */
  release(): void;
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
    release() {
      if (released) return;
      released = true;
      void server.stop(true);
    },
  };
}

export function reservePorts(count: number): readonly PortReservation[] {
  return Array.from({ length: count }, () => reservePort());
}

export async function waitForHttp(
  url: string,
  timeoutMs = 60_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await Bun.sleep(150);
  }
  throw new Error(
    `timed out waiting for ${url}${lastError === null ? '' : `: ${String(lastError)}`}`
  );
}
