// @io-wall-ok — web preview for the localhost product System profiles.

process.env['VITE_API_URL'] =
  process.env['VITE_API_URL'] ?? 'http://127.0.0.1:8787';
process.env['PREVIEW_PORT'] = process.env['PREVIEW_PORT'] ?? '5173';

await import('../../client/scripts/preview-server.ts');
