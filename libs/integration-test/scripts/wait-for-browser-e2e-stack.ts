import { waitForLocalE2eStack } from '../src/local-e2e-stack';

try {
  const stack = await waitForLocalE2eStack();
  process.stdout.write(
    `[wait-for-browser-e2e-stack] ready baseURL=${stack.baseURL}\n`
  );
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
