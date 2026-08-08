import { createTypedApiRpcClient } from '../src/shared/typed-api-rpc-client';

const API_URL = 'http://localhost:8788';
const MAX_WAIT_MS = 60_000;
const RETRY_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const client = createTypedApiRpcClient(API_URL);
  const started = performance.now();

  for (let attempt = 1; ; attempt++) {
    const t0 = performance.now();

    let res: Response;
    try {
      res = (await client.api['client-config'].refresh.$post(undefined, {
        init: { signal: AbortSignal.timeout(10_000) },
      })) as unknown as Response;
    } catch (e) {
      const elapsed = performance.now() - started;
      const msg = e instanceof Error ? e.message : String(e);

      if (elapsed < MAX_WAIT_MS) {
        process.stdout.write(
          `[dev-refresh] waiting for API… ${msg} (attempt ${attempt}, ${Math.round(elapsed / 1000)}s elapsed)\n`
        );
        await sleep(RETRY_MS);
        continue;
      }

      process.stderr.write(
        `[dev-refresh] gave up after ${Math.round(elapsed / 1000)}s: ${msg}\n`
      );
      process.exit(1);
    }

    const ms = Math.round(performance.now() - t0);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const totalElapsed = performance.now() - started;

      if (res.status >= 500 && totalElapsed < MAX_WAIT_MS) {
        process.stdout.write(
          `[dev-refresh] HTTP ${res.status}, retrying… (attempt ${attempt})\n`
        );
        await sleep(RETRY_MS);
        continue;
      }

      process.stderr.write(
        `[dev-refresh] HTTP ${res.status} (${ms}ms)${body ? ` — ${body.slice(0, 200)}` : ''}\n`
      );
      process.exit(1);
    }

    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
    } | null;
    if (json?.ok !== true) {
      process.stderr.write(
        `[dev-refresh] unexpected response: ${JSON.stringify(json).slice(0, 200)}\n`
      );
      process.exit(1);
    }

    process.stdout.write(`[dev-refresh] client config refreshed (${ms}ms)\n`);
    return;
  }
}

await main();
