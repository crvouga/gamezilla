import { useAuthClientPort } from './auth-client-provider';
import type { SignInTriggerResult } from './sign-in-trigger';

/** Triggers hosted Google sign-in via {@link AuthClientPort.signIn}. */
export function useSignIn(): {
  signInWithGoogle: () => Promise<SignInTriggerResult>;
} {
  const port = useAuthClientPort();

  const signInWithGoogle = async () => {
    await port.signIn('oauth-google');
    return 'completed' as const;
  };

  return { signInWithGoogle };
}
