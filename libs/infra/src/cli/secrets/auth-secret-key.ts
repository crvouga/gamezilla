import type { SecretEntry } from './types';

export class AuthSecretKey implements SecretEntry {
  readonly secretKey = 'AUTH_SECRET_KEY';
  readonly env = 'AUTH_SECRET_KEY';
  readonly hint = 'Auth provider secret key';

  async validate(value: string): Promise<string | null> {
    if (value.trim().length === 0) {
      return 'must be non-empty';
    }
    return null;
  }
}
