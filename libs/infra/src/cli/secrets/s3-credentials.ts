import type { SecretEntry } from './types';

function requireNonEmpty(value: string): string | null {
  return value.trim().length === 0 ? 'Must be non-empty when set' : null;
}

export class S3AccessKeyId implements SecretEntry {
  readonly secretKey = 'S3_ACCESS_KEY_ID';
  readonly env = 'S3_ACCESS_KEY_ID';
  readonly hint = 'S3-compatible object storage access key ID';

  async validate(value: string): Promise<string | null> {
    return requireNonEmpty(value);
  }
}

export class S3SecretAccessKey implements SecretEntry {
  readonly secretKey = 'S3_SECRET_ACCESS_KEY';
  readonly env = 'S3_SECRET_ACCESS_KEY';
  readonly hint = 'S3-compatible object storage secret access key';

  async validate(value: string): Promise<string | null> {
    return requireNonEmpty(value);
  }
}

export class S3Bucket implements SecretEntry {
  readonly secretKey = 'S3_BUCKET';
  readonly env = 'S3_BUCKET';
  readonly hint = 'S3-compatible object storage bucket name';

  async validate(value: string): Promise<string | null> {
    return requireNonEmpty(value);
  }
}

export class S3Endpoint implements SecretEntry {
  readonly secretKey = 'S3_ENDPOINT';
  readonly env = 'S3_ENDPOINT';
  readonly hint =
    'S3-compatible API endpoint, e.g. https://s3.us-west-004.backblazeb2.com';

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

export class S3Region implements SecretEntry {
  readonly secretKey = 'S3_REGION';
  readonly env = 'S3_REGION';
  readonly hint =
    'S3-compatible region slug, e.g. us-west-004 (matches the endpoint region)';

  async validate(value: string): Promise<string | null> {
    return requireNonEmpty(value);
  }
}
