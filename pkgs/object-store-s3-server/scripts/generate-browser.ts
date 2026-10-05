// @io-wall-ok — build entrypoint; generated browser adapter is written at install.
import { resolve } from 'node:path';

// Bun's runtime loader ignores the SDK's browser map for runtimeConfig, mixing
// its Node constructor with browser-only exports. Bundle the same adapter as
// a browser bundler does, rather than replacing SDK functions in tests.
const result = await Bun.build({
  entrypoints: [resolve(import.meta.dirname, '../src/impl-s3.ts')],
  outdir: resolve(import.meta.dirname, '../.cache/browser'),
  target: 'browser',
  format: 'esm',
  external: ['@pkgs/*'],
  minify: true,
});

if (!result.success)
  throw new AggregateError(result.logs, 'S3 browser build failed');
