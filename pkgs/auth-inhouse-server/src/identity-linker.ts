/**
 * Who a freshly authenticated provider identity signs in as — the account
 * linking policy, in one place.
 *
 * Sign-in:
 * 1. A known identity signs in as its user (its address and name refresh).
 * 2. A new identity whose **verified** address matches another identity's
 *    **verified** address joins that user (automatic linking). Both sides
 *    must be verified: a provider that does not vouch for the address is not
 *    evidence the same person holds both accounts.
 * 3. A new identity whose address matches but where either side is
 *    unverified is parked as a *pending link*: the person must sign in with
 *    the existing account to attach it, or explicitly choose a separate one.
 * 4. Otherwise it is a new user.
 *
 * Linking from a signed-in session attaches the identity to that user, unless
 * it already belongs to someone else, or the user already has a different
 * identity from the same provider (one per provider).
 *
 * Nothing here ever moves an identity from one user to another: merging two
 * existing accounts is refused, never guessed.
 */

import type { AuthErrorCode } from '@pkgs/auth-root-shared/auth-error-code';
import { AUTH_ERROR } from '@pkgs/auth-root-shared/auth-error-code';
import type { OauthProviderId } from '@pkgs/auth-root-shared/sign-in-method';
import { isOauthProviderId } from '@pkgs/auth-root-shared/sign-in-method';
import type { Clock } from '@pkgs/clock-shared/types';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import type { IdentityRow } from './identity-repository';
import { IdentityRepository } from './identity-repository';
import { IdpRepository } from './idp-repository';
import { PendingLinkRepository } from './pending-link-repository';
import type { ProviderIdentity } from './provider-identity';
import { syncUserProfile } from './user-profile-sync';

export type LinkOutcome =
  | {
      readonly kind: 'signed_in';
      readonly userId: string;
      /** The identity was attached to an existing user just now. */
      readonly linked: boolean;
      /** A brand-new user was created. */
      readonly created: boolean;
    }
  | { readonly kind: 'error'; readonly error: AuthErrorCode }
  | {
      readonly kind: 'link_required';
      readonly token: string;
      /** The existing account's address, masked for display. */
      readonly email: string;
      /** Providers that can prove the existing account. */
      readonly providers: readonly OauthProviderId[];
      readonly provider: OauthProviderId;
    };

export type LinkerDeps = {
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly secret: string;
};

/** `alice@gmail.com` → `a•••e@gmail.com`: enough to recognise, not to harvest. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '•••';
  const local = email.slice(0, at);
  const tail = local.length > 2 ? local.slice(-1) : '';
  return `${local.slice(0, 1)}•••${tail}${email.slice(at)}`;
}

function signedIn(
  userId: string,
  flags: { linked?: boolean; created?: boolean } = {}
): LinkOutcome {
  return {
    kind: 'signed_in',
    userId,
    linked: flags.linked ?? false,
    created: flags.created ?? false,
  };
}

function error(code: AuthErrorCode): LinkOutcome {
  return { kind: 'error', error: code };
}

export class IdentityLinker {
  private readonly identities: IdentityRepository;
  private readonly users: IdpRepository;
  private readonly pending: PendingLinkRepository;

  constructor(
    tx: SqlTx,
    private readonly deps: LinkerDeps
  ) {
    this.identities = new IdentityRepository(tx, deps.clock, deps.createId);
    this.users = new IdpRepository(tx, deps.clock, deps.createId, deps.secret);
    this.pending = new PendingLinkRepository(tx, deps);
  }

  private async sync(userId: string): Promise<void> {
    await syncUserProfile({
      users: this.users,
      identities: this.identities,
      userId,
    });
  }

  /**
   * Attach to an existing user. An identity someone else holds is refused
   * first (it is the more fundamental "no"), then "one identity per provider".
   */
  private async attach(
    userId: string,
    identity: ProviderIdentity
  ): Promise<LinkOutcome> {
    const holder = await this.identities.find(
      identity.provider,
      identity.providerUserId
    );
    if (holder !== null && holder.userId !== userId) {
      return error(AUTH_ERROR.identityAlreadyLinked);
    }
    // Already this user's (linked meanwhile from another device): done.
    if (holder !== null) return signedIn(userId);
    const mine = await this.identities.listForUser(userId);
    if (mine.some((row) => row.provider === identity.provider)) {
      return error(AUTH_ERROR.providerAlreadyLinked);
    }
    // Concurrent callbacks race on the unique key; the loser adopts the winner.
    const owner = await this.identities.insert(userId, identity);
    if (owner !== userId) return error(AUTH_ERROR.identityAlreadyLinked);
    await this.sync(userId);
    return signedIn(userId, { linked: true });
  }

  private async createUser(identity: ProviderIdentity): Promise<LinkOutcome> {
    const userId = this.deps.createId();
    const owner = await this.identities.insert(userId, identity);
    if (owner !== userId) return signedIn(owner);
    await this.users.insertUser({
      id: userId,
      email: identity.email,
      name: identity.name,
      image: identity.picture,
    });
    await this.sync(userId);
    return signedIn(userId, { created: true });
  }

  /** Link from a signed-in session (`intent=link`). */
  async link(userId: string, identity: ProviderIdentity): Promise<LinkOutcome> {
    const existing = await this.identities.find(
      identity.provider,
      identity.providerUserId
    );
    if (existing !== null) {
      if (existing.userId !== userId) {
        return error(AUTH_ERROR.identityAlreadyLinked);
      }
      await this.identities.refresh(identity);
      await this.sync(userId);
      return signedIn(userId);
    }
    return await this.attach(userId, identity);
  }

  /** Sign in (`intent=sign_in`), optionally finishing a pending link. */
  async signIn(
    identity: ProviderIdentity,
    pendingLinkId: string | null
  ): Promise<LinkOutcome> {
    const existing = await this.identities.find(
      identity.provider,
      identity.providerUserId
    );
    if (pendingLinkId !== null) {
      return await this.confirmPending(identity, existing, pendingLinkId);
    }
    if (existing === null) return await this.signInNew(identity);
    await this.identities.refresh(identity);
    await this.sync(existing.userId);
    return signedIn(existing.userId);
  }

  /**
   * The person was asked to prove the account a parked identity matched.
   * Proving it attaches the parked identity; signing in as anyone else —
   * including a brand-new identity — discards it.
   */
  private async confirmPending(
    identity: ProviderIdentity,
    existing: IdentityRow | null,
    pendingLinkId: string
  ): Promise<LinkOutcome> {
    const pending = await this.pending.findById(pendingLinkId);
    if (pending === null) return error(AUTH_ERROR.expired);
    await this.pending.consume(pending.id);
    if (existing === null || existing.userId !== pending.targetUserId) {
      return error(AUTH_ERROR.linkMismatch);
    }
    await this.identities.refresh(identity);
    return await this.attach(existing.userId, pending.identity);
  }

  /**
   * Identities elsewhere claiming the same address, dropping users who
   * already hold an identity from this provider: they could never accept a
   * second one, so they are not candidates (two accounts at one provider that
   * swapped an address are two people as far as linking is concerned).
   */
  private async candidates(identity: ProviderIdentity): Promise<IdentityRow[]> {
    if (identity.email === null || identity.isPrivateEmail) return [];
    const matches = await this.identities.findByEmail(identity.email);
    const out: IdentityRow[] = [];
    for (const row of matches) {
      const theirs = await this.identities.listForUser(row.userId);
      if (!theirs.some((mine) => mine.provider === identity.provider)) {
        out.push(row);
      }
    }
    return out;
  }

  private async signInNew(identity: ProviderIdentity): Promise<LinkOutcome> {
    const matches = await this.candidates(identity);
    const target = matches[0];
    if (target === undefined) return await this.createUser(identity);
    const verified = matches.find((row) => row.emailVerified);
    if (identity.emailVerified && verified !== undefined) {
      return await this.attach(verified.userId, identity);
    }
    return await this.requireLink(target, identity);
  }

  private async requireLink(
    target: IdentityRow,
    identity: ProviderIdentity
  ): Promise<LinkOutcome> {
    const theirs = await this.identities.listForUser(target.userId);
    const providers = [
      ...new Set(theirs.map((row) => row.provider).filter(isOauthProviderId)),
    ];
    const token = await this.pending.create({
      targetUserId: target.userId,
      identity,
    });
    return {
      kind: 'link_required',
      token,
      email: maskEmail(target.email ?? ''),
      providers,
      provider: identity.provider,
    };
  }

  /** The person declined to link: the parked identity becomes its own user. */
  async createSeparate(token: string): Promise<LinkOutcome> {
    const pending = await this.pending.findByToken(token);
    if (pending === null) return error(AUTH_ERROR.expired);
    await this.pending.consume(pending.id);
    const existing = await this.identities.find(
      pending.identity.provider,
      pending.identity.providerUserId
    );
    if (existing !== null) return signedIn(existing.userId);
    const userId = this.deps.createId();
    await this.identities.insert(userId, pending.identity);
    await this.users.insertUser({
      id: userId,
      email: pending.identity.email,
      name: pending.identity.name,
      image: pending.identity.picture,
    });
    await this.sync(userId);
    return signedIn(userId, { created: true });
  }
}
