/**
 * One registered OAuth callback shared by every deployment of the IdP.
 *
 * Providers redirect only to callback URIs registered in their consoles, and
 * those registrations are not reconcilable from code — so each deployment
 * with its own callback would need a hand edit. With a relay, every
 * deployment sends the same `redirect_uri` (the relay's callback) and
 * prefixes each `state` it mints with its own tag. The relay — its own tiny
 * service, not one of the deployments — forwards each callback to the
 * deployment its tag names, query (or `form_post` body) intact. The owner
 * finishes the round trip against its own state row, PKCE verifier included,
 * so a forwarded code is useless anywhere else.
 *
 * Targets are a closed map fixed at the relay's deploy time: a callback with
 * an unknown or missing tag is refused, never forwarded. Every deployment
 * serves the callback at the same path.
 */
import { type Context, Hono } from 'hono';

/** How a deployment takes part: the relay it names and its own tag. */
export type OauthCallbackRelay = {
  /** Origin whose `…/auth/callback/<provider>` is registered with providers. */
  readonly callbackOrigin: string;
  /** This deployment's tag, prefixed to every `state` it mints. */
  readonly stateTag: string;
};

/** Tags are slugs (`[a-z0-9-]`) and states are ids: neither contains `.`. */
const TAG_SEPARATOR = '.';

export const STATE_TAG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function tagState(stateTag: string | null, state: string): string {
  return stateTag === null ? state : `${stateTag}${TAG_SEPARATOR}${state}`;
}

function tagOf(state: string): string | null {
  const at = state.indexOf(TAG_SEPARATOR);
  return at <= 0 ? null : state.slice(0, at);
}

/** The URL to forward this callback to, or `null` when no target owns it. */
function relayTarget(args: {
  readonly forwardTo: Readonly<Record<string, string>>;
  readonly state: string;
  readonly requestUrl: string;
}): string | null {
  const tag = tagOf(args.state);
  if (tag === null || !Object.hasOwn(args.forwardTo, tag)) return null;
  const origin = args.forwardTo[tag];
  if (origin === undefined) return null;
  const incoming = new URL(args.requestUrl);
  return `${origin}${incoming.pathname}${incoming.search}`;
}

async function callbackState(c: Context): Promise<string> {
  const fromQuery = new URL(c.req.url).searchParams.get('state');
  if (fromQuery !== null) return fromQuery;
  if (c.req.method !== 'POST') return '';
  const body = await c.req.parseBody().catch(() => ({}));
  const fromBody = (body as Record<string, unknown>)['state'];
  return typeof fromBody === 'string' ? fromBody : '';
}

/**
 * The relay service: `<publicPathPrefix>/auth/callback/:provider` → the
 * tagged deployment's same path. Nothing else is served.
 */
export function createOauthCallbackRelayApp(options: {
  readonly forwardTo: Readonly<Record<string, string>>;
  readonly publicPathPrefix: string;
}): Hono {
  const app = new Hono();
  const forward = async (c: Context): Promise<Response> => {
    const target = relayTarget({
      forwardTo: options.forwardTo,
      state: await callbackState(c),
      requestUrl: c.req.url,
    });
    if (target === null) return c.json({ error: 'unknown_state' }, 400);
    // 307 keeps a `form_post` callback a POST with its body.
    return c.redirect(target, c.req.method === 'POST' ? 307 : 302);
  };
  const path = `${options.publicPathPrefix.replace(/\/$/, '')}/auth/callback/:provider`;
  app.get(path, forward);
  app.post(path, forward);
  return app;
}

/** Parses the relay's `{ tag: origin }` target map (a Worker var). */
export function parseRelayTargets(
  raw: string,
  label: string
): Readonly<Record<string, string>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${label} is not JSON`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object of tag → origin`);
  }
  const targets: Record<string, string> = {};
  for (const [tag, origin] of Object.entries(parsed)) {
    if (!STATE_TAG_PATTERN.test(tag) || typeof origin !== 'string') {
      throw new Error(`${label}: bad entry "${tag}"`);
    }
    const url = new URL(origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error(`${label}.${tag} must be an http(s) origin`);
    }
    targets[tag] = url.origin;
  }
  return targets;
}
