import type { SignInMethodId } from '@pkgs/auth-root-shared/sign-in-method';

/**
 * The address matched an existing account, but not with both sides verified:
 * sign in with one of `providers` to connect, or keep a separate account.
 */
export class AuthLinkRequiredError extends Error {
  readonly token: string;
  readonly email: string;
  /** Sign-in methods that can prove the existing account. */
  readonly providers: readonly SignInMethodId[];
  /** The sign-in method just used, waiting to be connected. */
  readonly provider: SignInMethodId;

  constructor(args: {
    readonly token: string;
    readonly email: string;
    readonly providers: readonly SignInMethodId[];
    readonly provider: SignInMethodId;
  }) {
    super('auth: link_required');
    this.name = 'AuthLinkRequiredError';
    this.token = args.token;
    this.email = args.email;
    this.providers = args.providers;
    this.provider = args.provider;
  }
}
