import { useAuthClientPort } from './auth-client-provider';
import type { SignInTriggerResult } from './sign-in-trigger';

/**
 * Triggers hosted sign-in via {@link AuthClientPort.signIn}.
 * Google and Dev both use OAuth auth-session + session exchange.
 */
export function useSignIn(): {
  signInWithGoogle: () => Promise<SignInTriggerResult>;
  signInWithDev: () => Promise<SignInTriggerResult>;
} {
  const port = useAuthClientPort();

  const signInWithGoogle = async () => {
    await port.signIn('oauth-google');
    return 'completed' as const;
  };

  const signInWithDev = async () => {
    await port.signIn('oauth-dev');
    return 'completed' as const;
  };

  return { signInWithGoogle, signInWithDev };
}
