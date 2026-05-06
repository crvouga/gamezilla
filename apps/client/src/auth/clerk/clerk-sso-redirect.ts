import * as AuthSession from 'expo-auth-session';

/**
 * Path segment for Expo Router `app/sso-callback.tsx` — must match hosted
 * `useSSO` redirect (see `@clerk/clerk-expo` default `makeRedirectUri`).
 */
export const hostedSsoCallbackPath = 'sso-callback' as const;

export function hostedSsoRedirectUri(): string {
  return AuthSession.makeRedirectUri({ path: hostedSsoCallbackPath });
}
