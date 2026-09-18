/** The built SPA, served from the embedded bundle the server renderer ships. */

import type { Context } from 'hono';

import {
  IDP_ASSET_CSS_PATH,
  IDP_ASSET_JS_PATH,
  IDP_FAVICON_PATH,
} from '../../shared/paths';
import { IDP_SPA_CSS, IDP_SPA_JS } from '../assets.generated';

/**
 * Google's four-arc "G". The browser asks for it implicitly on every page; a
 * 404 there is the one console error the screens would otherwise produce.
 */
const FAVICON = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">',
  '<path fill="#4285f4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>',
  '<path fill="#34a853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>',
  '<path fill="#fbbc05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>',
  '<path fill="#ea4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>',
  '</svg>',
].join('');

const ASSETS: Record<string, { readonly body: string; readonly type: string }> =
  {
    [IDP_ASSET_CSS_PATH]: {
      body: IDP_SPA_CSS,
      type: 'text/css; charset=utf-8',
    },
    [IDP_ASSET_JS_PATH]: {
      body: IDP_SPA_JS,
      type: 'text/javascript; charset=utf-8',
    },
    [IDP_FAVICON_PATH]: { body: FAVICON, type: 'image/svg+xml' },
  };

function respond(body: string, type: string): Response {
  return new Response(body, {
    headers: {
      'content-type': type,
      'cache-control': 'public, max-age=3600',
    },
  });
}

/** `GET /idp-assets/*` — the built SPA, from the committed bundle. */
export async function handleIdpAsset(c: Context): Promise<Response> {
  const asset = ASSETS[new URL(c.req.url).pathname];
  if (asset === undefined) return await c.notFound();
  return respond(asset.body, asset.type);
}
