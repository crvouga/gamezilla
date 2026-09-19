/**
 * Serves the mock provider's hosted pages: one Solid SPA (checkout + portal)
 * whose built JS/CSS are embedded in the server bundle, so every API host —
 * Bun, the in-process sim and a Worker — serves identical files without a
 * filesystem. The files go through the runtime-agnostic static file server;
 * both page routes resolve to the same shell and the SPA routes on its URL.
 */
import { createStaticFileHandler } from '@pkgs/static-file-server/static-file-server';

import { MOCK_BILLING_ASSETS } from '../shared/mock-billing-contract';
import {
  MOCK_BILLING_SPA_CSS,
  MOCK_BILLING_SPA_JS,
} from './mock-billing-assets.generated';

const FAVICON = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">',
  '<rect width="32" height="32" rx="8" fill="#4f46e5"/>',
  '<path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  '</svg>',
].join('');

/** Relative asset URLs resolve against the page, so the mount can move. */
const SHELL = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>Billing</title>
<link rel="icon" href="favicon.svg" type="image/svg+xml">
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
  [`/${MOCK_BILLING_ASSETS.js}`]: MOCK_BILLING_SPA_JS,
  [`/${MOCK_BILLING_ASSETS.css}`]: MOCK_BILLING_SPA_CSS,
  '/favicon.svg': FAVICON,
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
  },
});

/** The SPA's path under the mock mount (`/assets/app.js`, `/index.html`). */
export type MockBillingFile = '/index.html' | `/${string}`;

/** Serves one embedded file; unknown paths fall back to the SPA shell. */
export async function serveMockBillingFile(
  requestUrl: string,
  file: MockBillingFile
): Promise<Response> {
  const response = await staticFiles(new Request(new URL(file, requestUrl)));
  const headers = new Headers(response.headers);
  headers.set(
    'cache-control',
    file === '/index.html' ? 'no-store' : 'public, max-age=300'
  );
  return new Response(response.body, { status: response.status, headers });
}
