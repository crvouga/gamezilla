// the non-web delivery path (desktop / Bun.WebView host)
// compiles from the same product sources, without macOS UI execution. Every
// product system registers it beside the in-process host
// (`defineProductSystem`), so any spec suite runs on it with `HARNESS_MODE=real`.

import { describe, expect, test } from 'bun:test';
import { bunWebviewRuntime } from '@libs/harness/bun-webview';
import { inProcessRuntime } from '@libs/harness/in-process';

describe('product hosts', () => {
  test('both hosts are exported factories', () => {
    expect(typeof inProcessRuntime).toBe('function');
    expect(typeof bunWebviewRuntime).toBe('function');
  });

  test('the bun-webview host compiles for the bun target', async () => {
    const build = await Bun.build({
      entrypoints: [`${import.meta.dir}/../src/bun-webview.ts`],
      target: 'bun',
      external: ['@apps/*', '@libs/*', '@pkgs/*'],
    });
    if (!build.success) {
      console.error('bun-webview build errors:', build.logs);
    }
    expect(build.success).toBe(true);
  });
});
