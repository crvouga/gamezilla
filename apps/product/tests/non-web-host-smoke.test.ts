// goal:room-to-grow:5 — non-web delivery path (desktop/Bun.WebView host)
// compiles and runs from the same product sources without macOS UI execution.

import { describe, expect, test } from 'bun:test';
import {
  bunWebviewRuntime,
  inProcessRuntime,
  product,
} from '@apps/product/sim';

describe('non-web host registration', () => {
  test('bunWebviewRuntime is exported as a function', () => {
    expect(typeof bunWebviewRuntime).toBe('function');
  });

  test('inProcessRuntime is exported as a function', () => {
    expect(typeof inProcessRuntime).toBe('function');
  });

  test('product is exported', () => {
    expect(product).toBeDefined();
    expect(typeof product.run).toBe('function');
  });

  test('in-process runtime smoke (seed=1)', async () => {
    const result = await product.run({
      seed: 1,
      runtime: 'in-process',
    });
    expect(result).toBeDefined();
  });
});

describe('bun-webview host build smoke', () => {
  test('bun-webview.ts compiles for bun target', async () => {
    const build = await Bun.build({
      entrypoints: ['src/sim/hosts/bun-webview.ts'],
      target: 'bun',
      external: ['@apps/*', '@libs/*', '@pkgs/*'],
      outdir: '/tmp',
    });

    expect(build.success).toBe(true);
    if (!build.success) {
      console.error('bun-webview build errors:', build.logs);
    }
  });
});
