import { assert } from '@gamezilla/shared/assert';
import type { CiPlatform } from './ci-platform';

export function requireAwsRegion(platform: CiPlatform): string {
  const r = process.env['AWS_REGION']?.trim();
  if (r === undefined || r === '') {
    platform.error('AWS_REGION is empty (must be set after configure-aws-credentials).');
    platform.error('Fix: Check that the configure-aws-credentials step ran successfully.');
    assert.fail('requireAwsRegion: AWS_REGION must be set');
  }
  return r;
}
