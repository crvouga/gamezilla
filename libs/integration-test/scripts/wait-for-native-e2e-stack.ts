import { NATIVE_E2E_BASE_URL, assertNativeE2eStackRunningSync } from '../src/local-e2e-stack';

const timeoutMs = Number(process.env['NATIVE_E2E_STACK_WAIT_MS'] ?? '900_000');
const pollMs = 1_000;
const deadline = Date.now() + timeoutMs;
let lastError: string | undefined;

while (Date.now() < deadline) {
  try {
    assertNativeE2eStackRunningSync(NATIVE_E2E_BASE_URL);
    process.stdout.write(
      `[wait-for-native-e2e-stack] ready baseURL=${NATIVE_E2E_BASE_URL}\n`
    );
    process.exit(0);
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    await Bun.sleep(pollMs);
  }
}

process.stderr.write(
  `[wait-for-native-e2e-stack] timed out after ${String(timeoutMs)}ms\n${lastError ?? ''}\n`
);
process.exit(1);
