import { DEV_PROVIDER, GOOGLE_PROVIDER } from '../../shared/auth/auth-entities';

const PROVIDER_LABELS: Record<string, string> = {
  [GOOGLE_PROVIDER]: 'Google',
  [DEV_PROVIDER]: 'Test Account',
};

/** Returns the localized display label for a provider key. */
export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}
