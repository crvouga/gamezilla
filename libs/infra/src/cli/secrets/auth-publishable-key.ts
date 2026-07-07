import type { SecretEntry } from './types';

export class AuthPublishableKey implements SecretEntry {
  readonly secretKey = 'AUTH_PUBLISHABLE_KEY';
  readonly env = 'AUTH_PUBLISHABLE_KEY';
  readonly hint = 'Auth provider publishable key (public)';

  async validate(value: string): Promise<string | null> {
    if (value.trim().length === 0) {
      return 'must be non-empty';
    }
    return null;
  }
}
