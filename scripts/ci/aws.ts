import assert from 'node:assert/strict';
import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { ghError } from './gh';

export function requireAwsRegion(): string {
  const r = process.env['AWS_REGION']?.trim();
  if (r === undefined || r === '') {
    ghError('AWS_REGION is empty (invariant: must be set after configure-aws-credentials).');
    process.exit(1);
  }
  assert(r.length > 0);
  return r;
}

export function cloudFormation(): CloudFormationClient {
  const region = requireAwsRegion();
  assert(region.length > 0);
  return new CloudFormationClient({ region });
}
