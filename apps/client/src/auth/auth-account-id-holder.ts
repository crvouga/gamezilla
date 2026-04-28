import type { InjectionToken } from '@gamezilla/lib/dependency-injection/dependency-injection-container';

/**
 * Mutable holder for the current session's account id, read by {@link LastModifiedByPatchesDb}
 * when stamping writes. Updated from session refresh / auth state.
 */
export class AuthAccountIdHolder {
  private value: string | null = null;

  get(): string | null {
    return this.value;
  }

  set(id: string | null): void {
    this.value = id;
  }
}

export const AuthAccountIdHolderToken: InjectionToken<AuthAccountIdHolder> =
  Symbol('AuthAccountIdHolder');
