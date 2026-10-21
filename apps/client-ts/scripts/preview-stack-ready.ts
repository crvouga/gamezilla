// @io-wall-ok
import { resolveLocalPreviewApiOriginSync } from '@libs/app-config-shared-ts/resolve-local-preview-api-origin';

/**
 * Readiness probe for `turbo preview`: the static export on
 * `PREVIEW_PORT` becomes reachable before wrangler finishes booting, so probing
 * `/` alone starts browser tests while the API is still down.
 */

const PROBE_TIMEOUT_MS = 2_000;

async function probeOk(url: string): Promise<boolean> {
  try {
    const res = await globalThis.fetch(url, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const body = (await res.text()).trim();
    return body.length > 0;
  } catch {
    return false;
  }
}

/** Returns 200 when the API worker is accepting traffic. */
export async function previewStackReadyResponse(): Promise<Response> {
  const apiTarget = resolveLocalPreviewApiOriginSync();
  const apiReady = await probeOk(`${apiTarget}/api/health`);
  if (apiReady) {
    return new Response('ok', { status: 200 });
  }
  return new Response('preview stack not ready', { status: 503 });
}
