import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import assert from 'node:assert/strict';
import { reportError } from './ci-platform';

export function requireAwsRegion(): string {
  const r = process.env['AWS_REGION']?.trim();
  if (r === undefined || r === '') {
    reportError(
      'AWS_REGION is empty (invariant: must be set after configure-aws-credentials).'
    );
    assert.fail(
      'requireAwsRegion: AWS_REGION must be set — crash, do not continue'
    );
  }
  assert(r.length > 0);
  return r;
}

export function cloudFormation(): CloudFormationClient {
  const region = requireAwsRegion();
  assert(region.length > 0);
  return new CloudFormationClient({ region });
}
