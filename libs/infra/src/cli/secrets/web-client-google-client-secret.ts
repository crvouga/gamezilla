import type { SecretEntry } from './types';

export class WebClientGoogleClientSecret implements SecretEntry {
  readonly secretKey = 'WEB_CLIENT_GOOGLE_CLIENT_SECRET';
  readonly env = 'WEB_CLIENT_GOOGLE_CLIENT_SECRET';
  readonly hint =
    'Google OAuth Web client secret paired with WEB_CLIENT_GOOGLE_CLIENT_ID';

  async validate(value: string): Promise<string | null> {
    const v = value.trim();
    if (v.length === 0) return 'Must be non-empty when set';
    if (v.length < 8) return 'Secret looks too short';
    return null;
  }
}
