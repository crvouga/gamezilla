/** The built SPA, served from the embedded bundle the server renderer ships. */

import type { Context } from 'hono';

import {
  IDP_ASSET_CSS_PATH,
  IDP_ASSET_JS_PATH,
  IDP_FAVICON_PATH,
} from '../../shared/paths';
import { IDP_SPA_CSS, IDP_SPA_JS } from '../assets.generated';

/**
 * The simulator's own mark, matching `brand-mark.tsx` in the design system's
 * light-scheme tint (a favicon cannot read CSS variables). The browser asks for it
 * implicitly on every page; a 404 there is the one console error the screens
 * would otherwise produce.
 */
const FAVICON = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">',
  '<rect width="48" height="48" rx="12" fill="hsl(221 83% 53%)"/>',
  '<circle cx="24" cy="20" r="6.5" fill="#ffffff"/>',
  '<path d="M21.4 25.5h5.2l1.9 9.8a1 1 0 0 1-1 1.2h-7a1 1 0 0 1-1-1.2z" fill="#ffffff"/>',
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
