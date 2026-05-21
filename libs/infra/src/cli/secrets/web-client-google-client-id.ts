import type { SecretEntry } from './types';

export class WebClientGoogleClientId implements SecretEntry {
  readonly secretKey = 'WEB_CLIENT_GOOGLE_CLIENT_ID';
  readonly env = 'WEB_CLIENT_GOOGLE_CLIENT_ID';
  readonly hint =
    'Google OAuth Web client ID (…apps.googleusercontent.com) for Better Auth';

  async validate(value: string): Promise<string | null> {
    const v = value.trim();
    if (v.length === 0) return 'Must be non-empty when set';
    if (!v.includes('.apps.googleusercontent.com')) {
      return 'Expected a Google OAuth client id ending in .apps.googleusercontent.com';
    }
    return null;
  }
}
