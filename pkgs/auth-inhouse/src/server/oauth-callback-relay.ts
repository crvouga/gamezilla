/**
 * One registered OAuth callback shared by every deployment of the IdP.
 *
 * Providers redirect only to callback URIs registered in their consoles, and
 * those registrations are not reconcilable from code — so each deployment
 * with its own callback would need a hand edit. With a relay, every
 * deployment sends the same `redirect_uri` (the relay deployment's callback)
 * and prefixes each `state` it mints with its own tag. The relay deployment
 * forwards a callback whose tag names another deployment to that deployment's
 * callback route, query (or `form_post` body) intact. The owner finishes the
 * round trip against its own state row, PKCE verifier included, so a
 * forwarded code is useless anywhere else.
 *
 * Targets are a closed map fixed at deploy time: an unknown tag is never
 * forwarded, it falls through to the local state lookup, which refuses it.
 * Every deployment serves the callback at the same path.
 */
export type OauthCallbackRelay = {
  /** Origin whose `…/auth/callback/<provider>` is registered with providers. */
  readonly callbackOrigin: string;
  /** This deployment's tag, prefixed to every `state` it mints. */
  readonly stateTag: string;
  /** Other deployments' API origins by tag: where their callbacks go. */
  readonly forwardTo: Readonly<Record<string, string>>;
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

/**
 * The URL to forward this callback to, or `null` when this deployment owns
 * it (no relay, an untagged state, its own tag, or a tag it does not know).
 */
export function relayTarget(args: {
  readonly relay: OauthCallbackRelay | undefined;
  readonly state: string;
  readonly requestUrl: string;
}): string | null {
  const { relay } = args;
  if (relay === undefined) return null;
  const tag = tagOf(args.state);
  if (tag === null || tag === relay.stateTag) return null;
  if (!Object.hasOwn(relay.forwardTo, tag)) return null;
  const origin = relay.forwardTo[tag];
  if (origin === undefined) return null;
  const incoming = new URL(args.requestUrl);
  return `${origin}${incoming.pathname}${incoming.search}`;
}
