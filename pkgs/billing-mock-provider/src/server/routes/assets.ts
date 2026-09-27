/**
 * The hosted pages' shell and built files. The SPA is embedded in the server
 * bundle, so every host — Bun, an in-process sim node — serves identical
 * files without a filesystem.
 */
import { createStaticFileHandler } from '@pkgs/static-file-server/static-file-server';
import { type Context, Hono } from 'hono';

import { MOCK_BILLING_BRAND } from '../../shared/brand';
import { MOCK_BILLING_ASSETS } from '../../shared/pages';
import { MOCK_BILLING_SPA_CSS, MOCK_BILLING_SPA_JS } from '../assets.generated';

const FAVICON = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">',
  '<rect width="32" height="32" rx="8" fill="#4f46e5"/>',
  '<path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  '</svg>',
].join('');

const SHELL = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>${MOCK_BILLING_BRAND.name}</title>
<link rel="icon" href="${MOCK_BILLING_ASSETS.favicon}" type="image/svg+xml">
<link rel="stylesheet" href="${MOCK_BILLING_ASSETS.css}">
<script type="module" src="${MOCK_BILLING_ASSETS.js}"></script>
</head>
<body>
<div id="mock-billing-root"></div>
<noscript>This page needs JavaScript.</noscript>
</body>
</html>`;

const FILES: Readonly<Record<string, string>> = {
  '/index.html': SHELL,
  [MOCK_BILLING_ASSETS.js]: MOCK_BILLING_SPA_JS,
  [MOCK_BILLING_ASSETS.css]: MOCK_BILLING_SPA_CSS,
  [MOCK_BILLING_ASSETS.favicon]: FAVICON,
};

const staticFiles = createStaticFileHandler({
  getFile: (pathname) => {
    const body = FILES[pathname];
    return body === undefined ? null : new Blob([body]);
  },
  mimeTypes: {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
  },
});

async function serve(c: Context, file: string): Promise<Response> {
  const response = await staticFiles(new Request(new URL(file, c.req.url)));
  const headers = new Headers(response.headers);
  headers.set(
    'cache-control',
    file === '/index.html' ? 'no-store' : 'public, max-age=300'
  );
  return new Response(response.body, { status: response.status, headers });
}

export function assetRoutes(): Hono {
  const page = (c: Context) => serve(c, '/index.html');
  return new Hono()
    .get('/c/pay/:id', page)
    .get('/p/session/:id', page)
    .get(MOCK_BILLING_ASSETS.js, (c) => serve(c, MOCK_BILLING_ASSETS.js))
    .get(MOCK_BILLING_ASSETS.css, (c) => serve(c, MOCK_BILLING_ASSETS.css))
    .get(MOCK_BILLING_ASSETS.favicon, (c) =>
      serve(c, MOCK_BILLING_ASSETS.favicon)
    );
}
