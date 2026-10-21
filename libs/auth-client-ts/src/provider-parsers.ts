import { GOOGLE_PROVIDER } from '@libs/auth-shared-ts/auth-entities';

const PROVIDER_LABELS: Record<string, string> = {
  [GOOGLE_PROVIDER]: 'Google',
};

/** Returns the localized display label for a provider key. */
export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}
