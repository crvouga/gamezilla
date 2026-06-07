import type { SecretEntry } from './types';

function requireNonEmpty(value: string): string | null {
  return value.trim().length === 0 ? 'Must be non-empty when set' : null;
}

export class B2ApplicationKeyId implements SecretEntry {
  readonly secretKey = 'B2_APPLICATION_KEY_ID';
  readonly env = 'B2_APPLICATION_KEY_ID';
  readonly hint =
    'Backblaze B2 application key ID — Backblaze console → Application Keys';

  async validate(value: string): Promise<string | null> {
    return requireNonEmpty(value);
  }
}

export class B2ApplicationKey implements SecretEntry {
  readonly secretKey = 'B2_APPLICATION_KEY';
  readonly env = 'B2_APPLICATION_KEY';
  readonly hint =
    'Backblaze B2 application key secret — Backblaze console → Application Keys';

  async validate(value: string): Promise<string | null> {
    return requireNonEmpty(value);
  }
}

export class B2BucketName implements SecretEntry {
  readonly secretKey = 'B2_BUCKET_NAME';
  readonly env = 'B2_BUCKET_NAME';
  readonly hint = 'Backblaze B2 bucket name for object storage';

  async validate(value: string): Promise<string | null> {
    return requireNonEmpty(value);
  }
}

export class B2S3Endpoint implements SecretEntry {
  readonly secretKey = 'B2_S3_ENDPOINT';
  readonly env = 'B2_S3_ENDPOINT';
  readonly hint =
    'Backblaze B2 S3-compatible endpoint, e.g. https://s3.us-west-004.backblazeb2.com';

  async validate(value: string): Promise<string | null> {
    const v = value.trim();
    if (v.length === 0) return 'Must be non-empty when set';
    try {
      const url = new URL(v);
      if (url.protocol !== 'https:') {
        return 'Must use https://';
      }
    } catch {
      return 'Must be a valid URL';
    }
    return null;
  }
}

export class B2S3Region implements SecretEntry {
  readonly secretKey = 'B2_S3_REGION';
  readonly env = 'B2_S3_REGION';
  readonly hint =
    'Backblaze B2 S3 region slug, e.g. us-west-004 (matches the endpoint region)';

  async validate(value: string): Promise<string | null> {
    return requireNonEmpty(value);
  }
}
