// @io-wall-ok — real-mode bun-webview web stack for @product/test

process.env['EXPO_PUBLIC_API_URL'] =
  process.env['EXPO_PUBLIC_API_URL'] ?? 'http://127.0.0.1:8787';
process.env['PREVIEW_PORT'] = process.env['PREVIEW_PORT'] ?? '5173';

await import('../../apps/client/scripts/preview-server.ts');
