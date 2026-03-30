import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { assert } from '@gamezilla/shared/assert';
import type { CiPlatform } from './ci-platform';

export function requireAwsRegion(platform: CiPlatform): string {
  const r = process.env['AWS_REGION']?.trim();
  if (r === undefined || r === '') {
    platform.error(
      'AWS_REGION is empty (invariant: must be set after configure-aws-credentials).'
    );
    assert.fail(
      'requireAwsRegion: AWS_REGION must be set — crash, do not continue'
    );
  }
  assert.ok(r.length > 0, 'requireAwsRegion: region must be non-empty');
  return r;
}

export function cloudFormation(platform: CiPlatform): CloudFormationClient {
  const region = requireAwsRegion(platform);
  assert.ok(region.length > 0, 'cloudFormation: region must be non-empty');
  return new CloudFormationClient({ region });
}
