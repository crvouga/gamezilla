import type { InjectionToken } from '@gamezilla/lib/dependency-injection/dependency-injection-container';

/**
 * Mutable holder for the current session bearer token, read by the patch-db HTTP
 * transport when stamping `Authorization: Bearer …`. Updated from session refresh
 * / sign-in / sign-out so the transport always sees the current token.
 */
export class AuthSessionTokenHolder {
  private value: string | null = null;

  get(): string | null {
    return this.value;
  }

  set(token: string | null): void {
    this.value = token;
  }
}

export const AuthSessionTokenHolderToken: InjectionToken<AuthSessionTokenHolder> =
  Symbol('AuthSessionTokenHolder');
