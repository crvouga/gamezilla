// @io-wall-ok — real-mode bun-webview web stack for @apps/product-ts

process.env['VITE_API_URL'] =
  process.env['VITE_API_URL'] ?? 'http://127.0.0.1:8787';
process.env['PREVIEW_PORT'] = process.env['PREVIEW_PORT'] ?? '5173';

await import('../../client-ts/scripts/preview-server.ts');

// A module, so the top-level await above type-checks.
export {};
