/**
 * Managing an account's sign-in methods from the client: list, link, unlink,
 * decline a pending link, and sign out everywhere.
 *
 * Linking opens the provider in the same popup sign-in uses, so the launch
 * must not await the network after the tap. The link ticket that authorizes
 * it is therefore minted ahead of time ({@link LinkingOps.prepareLink}) and
 * kept until it is spent or about to expire; without one, the tap mints it
 * first and accepts the popup-blocker risk that brings.
 */

import { AuthFlowError } from '@pkgs/auth-root-client-ts/auth-flow-error';
import type { AuthErrorCode } from '@pkgs/auth-root-shared-ts/auth-error-code';
import { AUTH_ERROR } from '@pkgs/auth-root-shared-ts/auth-error-code';
import type { AuthIdentity } from '@pkgs/auth-root-shared-ts/auth-identity';
import type {
  OauthProviderId,
  SignInMethodId,
} from '@pkgs/auth-root-shared-ts/sign-in-method';
import { isSignInMethodId } from '@pkgs/auth-root-shared-ts/sign-in-method';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import { apiUrl, buildOauthLaunchUrl, postJson } from './auth-client-http';
import type { SignInCtx } from './auth-client-oauth';
import {
  codeOrThrow,
  exchangeCode,
  persistSessionFromResponse,
  runOauthSession,
} from './auth-client-oauth';

/** Refresh the ticket this long before the server would reject it. */
const TICKET_MARGIN_MS = 60_000;

export type LinkingOps = {
  listIdentities(): Promise<readonly AuthIdentity[]>;
  prepareLink(): Promise<void>;
  linkProvider(provider: OauthProviderId): Promise<void>;
  unlinkProvider(provider: SignInMethodId): Promise<readonly AuthIdentity[]>;
  createSeparateAccount(pendingLinkToken: string): Promise<void>;
  signOutEverywhere(): Promise<void>;
};

function errorCodeOf(body: unknown): AuthErrorCode | null {
  if (body === null || typeof body !== 'object') return null;
  const raw = (body as Record<string, unknown>)['error'];
  const codes: readonly string[] = Object.values(AUTH_ERROR);
  return typeof raw === 'string' && codes.includes(raw)
    ? (raw as AuthErrorCode)
    : null;
}

function identitiesOf(body: unknown): readonly AuthIdentity[] {
  if (body === null || typeof body !== 'object') return [];
  const raw = (body as Record<string, unknown>)['identities'];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (row): row is AuthIdentity =>
      row !== null &&
      typeof row === 'object' &&
      isSignInMethodId(String((row as AuthIdentity).provider))
  );
}

async function requireToken(ctx: SignInCtx): Promise<string> {
  const token = await ctx.bearerStore.read();
  if (token === null) throw new Error('auth: not signed in');
  return token;
}

async function jsonOrThrow(res: Response): Promise<unknown> {
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) return body;
  const code = errorCodeOf(body);
  if (code !== null) throw new AuthFlowError(code);
  throw new Error(`auth: request failed (${String(res.status)})`);
}

/**
 * A ticket authorizes linking to the account that minted it, so it is kept
 * with the bearer it was minted under: after a sign-out and a sign-in as
 * someone else, a leftover ticket would link (and sign the device in) to the
 * previous account.
 */
type CachedTicket = {
  readonly value: string;
  readonly expiresAtMs: number;
  readonly bearer: string;
};

type TicketCache = {
  /** The cached ticket for `bearer`, while it has time left. */
  fresh(bearer: string): string | null;
  mint(bearer: string): Promise<string>;
  /** Tickets are single use: forget it once a launch spends it. */
  spend(): void;
};

function createTicketCache(ctx: SignInCtx, clock: Clock): TicketCache {
  let ticket: CachedTicket | null = null;
  return {
    fresh: (bearer) =>
      ticket !== null &&
      ticket.bearer === bearer &&
      ticket.expiresAtMs - TICKET_MARGIN_MS > clock.now()
        ? ticket.value
        : null,
    async mint(bearer) {
      const res = await postJson(
        ctx.config.fetch,
        apiUrl(ctx.config.baseURL, '/auth/link/ticket'),
        {},
        bearer
      );
      const body = (await jsonOrThrow(res)) as {
        ticket: string;
        expiresAt: string;
      };
      ticket = {
        value: body.ticket,
        expiresAtMs: Date.parse(body.expiresAt),
        bearer,
      };
      return body.ticket;
    },
    spend() {
      ticket = null;
    },
  };
}

export function createLinkingOps(ctx: SignInCtx, clock: Clock): LinkingOps {
  const tickets = createTicketCache(ctx, clock);
  const url = (path: string): string => apiUrl(ctx.config.baseURL, path);

  const linkWith = async (
    provider: OauthProviderId,
    linkTicket: string
  ): Promise<void> => {
    tickets.spend();
    const previous = await ctx.bearerStore.read();
    const outcome = await runOauthSession(
      ctx,
      buildOauthLaunchUrl({
        baseURL: ctx.config.baseURL,
        provider,
        callbackUrl: ctx.callbackUrl,
        linkTicket,
      })
    );
    await exchangeCode(ctx, codeOrThrow(outcome));
    // The exchange minted a fresh session for the same account; retire the
    // one it replaced so no orphan bearer stays valid for its whole TTL.
    if (previous !== null) {
      await postJson(ctx.config.fetch, url('/auth/sign-out'), {}, previous);
    }
  };

  return {
    async listIdentities() {
      const token = await requireToken(ctx);
      const res = await ctx.config.fetch(url('/auth/identities'), {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      });
      return identitiesOf(await jsonOrThrow(res));
    },
    async prepareLink() {
      const bearer = await requireToken(ctx);
      if (tickets.fresh(bearer) === null) await tickets.mint(bearer);
    },
    async linkProvider(provider) {
      const bearer = await requireToken(ctx);
      await linkWith(
        provider,
        tickets.fresh(bearer) ?? (await tickets.mint(bearer))
      );
    },
    async unlinkProvider(provider) {
      const res = await postJson(
        ctx.config.fetch,
        url('/auth/identities/unlink'),
        { provider },
        await requireToken(ctx)
      );
      return identitiesOf(await jsonOrThrow(res));
    },
    async createSeparateAccount(pendingLinkToken) {
      const res = await postJson(ctx.config.fetch, url('/auth/link/separate'), {
        token: pendingLinkToken,
      });
      if (!res.ok) await jsonOrThrow(res);
      await ctx.bearerStore.clear();
      await persistSessionFromResponse(ctx, res);
    },
    async signOutEverywhere() {
      const res = await postJson(
        ctx.config.fetch,
        url('/auth/sign-out-all'),
        {},
        await requireToken(ctx)
      );
      await jsonOrThrow(res);
    },
  };
}
