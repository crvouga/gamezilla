/**
 * Readiness probe for Playwright / `turbo preview`: the static export on :5173
 * becomes reachable before wrangler and the dev IdP finish booting, so probing
 * `/` alone starts browser tests while OAuth still fails with "Dev sign-in failed".
 */
import { resolveLocalPreviewApiProxyTarget } from './local-api-proxy';

/** Mirrors {@link @pkgs/dev-idp/config} defaults — not imported to avoid a client → dev-idp dep. */
const DEV_IDP_DEFAULT_PORT = 5556;
const DEV_IDP_PATH_PREFIX = '/dev-idp';
const DEV_IDP_AUTHORIZE_PATH = `${DEV_IDP_PATH_PREFIX}/authorize`;

const PROBE_TIMEOUT_MS = 2_000;

function resolveDevIdpAuthorizeUrl(): string {
  const raw = process.env['DEV_IDP_PORT']?.trim();
  const port =
    raw !== undefined && raw.length > 0 ? Number(raw) : DEV_IDP_DEFAULT_PORT;
  const resolved =
    Number.isInteger(port) && port > 0 && port <= 65_535
      ? port
      : DEV_IDP_DEFAULT_PORT;
  return `http://127.0.0.1:${String(resolved)}${DEV_IDP_AUTHORIZE_PATH}`;
}

async function probeOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Returns 200 when the API worker and dev IdP are both accepting traffic. */
export async function previewStackReadyResponse(): Promise<Response> {
  const apiTarget = resolveLocalPreviewApiProxyTarget();
  const [apiReady, devIdpReady] = await Promise.all([
    probeOk(`${apiTarget}/api/health`),
    probeOk(resolveDevIdpAuthorizeUrl()),
  ]);
  if (apiReady && devIdpReady) {
    return new Response('ok', { status: 200 });
  }
  return new Response('preview stack not ready', { status: 503 });
}
