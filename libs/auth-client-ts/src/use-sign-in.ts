import type { SignInTriggerResult } from '@libs/auth-shared-ts/sign-in-trigger';
import type { SignInOptions } from '@pkgs/auth-root-shared-ts/auth-client-port';
import type { OauthProviderId } from '@pkgs/auth-root-shared-ts/sign-in-method';
import { useAuthClientPort } from './auth-client-provider';

/**
 * Hosted sign-in via {@link AuthClientPort.signIn}. A sign-in whose address
 * matched another account rejects with `AuthLinkRequiredError`; finish it by
 * signing in again with `{ pendingLink }`, or with `createSeparateAccount`.
 */
export function useSignIn(): {
  signInWith: (
    provider: OauthProviderId,
    options?: SignInOptions
  ) => Promise<SignInTriggerResult>;
  createSeparateAccount: (
    pendingLinkToken: string
  ) => Promise<SignInTriggerResult>;
} {
  const port = useAuthClientPort();
  return {
    signInWith: async (provider, options) => {
      await port.signIn(provider, options);
      return 'completed' as const;
    },
    createSeparateAccount: async (token) => {
      await port.createSeparateAccount(token);
      return 'completed' as const;
    },
  };
}
