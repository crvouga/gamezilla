import { assert } from '@gamezilla/shared/assert';
import { ok, warn } from '../fmt';
import { runCapture } from '../subprocess';
import type { CiPlatform } from '../platform';

export function ensureAwsEnvCredentials(): void {
  if (
    process.env['AWS_ACCESS_KEY_ID'] &&
    process.env['AWS_SECRET_ACCESS_KEY']
  ) {
    return;
  }
  try {
    const raw = runCapture('aws', [
      'configure',
      'export-credentials',
      '--format',
      'process',
    ]);
    const creds = JSON.parse(raw) as {
      Version?: number;
      AccessKeyId?: string;
      SecretAccessKey?: string;
      SessionToken?: string;
    };
    if (creds.AccessKeyId) process.env['AWS_ACCESS_KEY_ID'] = creds.AccessKeyId;
    if (creds.SecretAccessKey)
      process.env['AWS_SECRET_ACCESS_KEY'] = creds.SecretAccessKey;
    if (creds.SessionToken)
      process.env['AWS_SESSION_TOKEN'] = creds.SessionToken;
    ok('AWS credentials resolved to environment');
  } catch {
    warn('Could not export AWS credentials', 'terraform may fail if using SSO');
  }
}

export function requireAwsRegion(platform: CiPlatform): string {
  const r = process.env['AWS_REGION']?.trim();
  if (r === undefined || r === '') {
    platform.error('AWS_REGION is empty (must be set after configure-aws-credentials).');
    platform.error('Fix: Check that the configure-aws-credentials step ran successfully.');
    assert.fail('requireAwsRegion: AWS_REGION must be set');
  }
  return r;
}
