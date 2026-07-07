import { requireLocalE2eStackSync } from '../src/local-e2e-stack';

const timeoutMs = Number(process.env['BROWSER_E2E_STACK_WAIT_MS'] ?? '240000');
const pollMs = 1_000;
const deadline = Date.now() + timeoutMs;
let lastError: string | undefined;

while (Date.now() < deadline) {
  try {
    const stack = requireLocalE2eStackSync();
    process.stdout.write(
      `[wait-for-browser-e2e-stack] ready baseURL=${stack.baseURL}\n`
    );
    process.exit(0);
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    await Bun.sleep(pollMs);
  }
}

process.stderr.write(
  `[wait-for-browser-e2e-stack] timed out after ${String(timeoutMs)}ms\n${lastError ?? ''}\n`
);
process.exit(1);
