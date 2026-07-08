/**
 * Starts Metro (`expo start --web`) for the native-launch E2E smoke.
 *
 * Do NOT use `expo export --platform web --dev` here: Expo SDK 54's Metro
 * serializer hashes every chunk as `md5('')` when `dev: true`, so static
 * `_expo/static/js/web/*-d41d8….js` files overwrite each other and the SPA
 * HTML either ships with no `<script>` tags or an incomplete entry
 * (`__d is not defined`). Live Metro serves a real `__DEV__` bundle the way
 * Expo Go does locally.
 *
 * Env: pass `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL=1`
 * like OTA publish so the Tiger production-API guard is exercised.
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assert } from '@pkgs/assert';

const clientRoot = join(fileURLToPath(import.meta.url), '..', '..');
const port = process.env['NATIVE_E2E_PORT'] ?? '5174';

assert.ok(/^\d+$/.test(port), `NATIVE_E2E_PORT must be digits, got ${port}`);

const child = spawn(
  'bun',
  ['--bun', 'x', 'expo', 'start', '--web', '--port', port],
  {
    cwd: clientRoot,
    env: process.env,
    stdio: 'inherit',
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    child.kill(sig);
  });
}
