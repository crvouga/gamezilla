import { assert } from '@gamezilla/shared/assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STACK_NAME } from './cfn-shared';
import { CiPlatform } from './ci-platform';
import { AWS_PACKAGE_ROOT } from './paths';

export type StackOutputs = Readonly<Record<string, string | undefined>>;

export function readCdkOutputs(
  platform: CiPlatform,
  file?: string
): StackOutputs {
  const path = file ?? join(AWS_PACKAGE_ROOT, 'cdk-outputs.json');
  assert.ok(
    typeof path === 'string' && path.length > 0,
    'readCdkOutputs: path must be non-empty'
  );

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    platform.error(`Failed to read ${path}: ${String(e)}`);
    platform.error(
      'Fix: Ensure "cdk deploy --outputs-file cdk-outputs.json" ran successfully before this step.'
    );
    assert.fail(`readCdkOutputs: cannot parse ${path}`);
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    platform.error('Invalid CDK outputs JSON (expected object)');
    platform.error(
      `Fix: ${path} must be a JSON object written by "cdk deploy --outputs-file". Delete and re-run cdk deploy.`
    );
    assert.fail('readCdkOutputs: must be a JSON object');
  }

  const doc = raw as Record<string, Record<string, string> | undefined>;
  const stack = doc[STACK_NAME];
  if (stack === undefined || typeof stack !== 'object') {
    platform.error(`Missing "${STACK_NAME}" in CDK outputs`);
    platform.error(
      `Fix: ${path} exists but does not contain the key "${STACK_NAME}". Re-run "cdk deploy --outputs-file cdk-outputs.json".`
    );
    assert.fail(`readCdkOutputs: "${STACK_NAME}" key missing`);
  }

  return stack;
}

export function requireOutput(
  platform: CiPlatform,
  outputs: StackOutputs,
  key: string
): string {
  assert.nonEmptyString(key, 'requireOutput: key must be non-empty');
  const v = outputs[key];
  if (v === undefined || v === '' || v === 'null') {
    platform.error(
      `CDK output "${key}" missing or empty (invariant: must be set after cdk deploy).`
    );
    platform.error(
      `Fix: Ensure the CDK stack exports "${key}" via CfnOutput. Re-run "cdk deploy" if the stack was updated.`
    );
    assert.fail(`requireOutput: "${key}" must be non-empty`);
  }
  assert.ok(
    typeof v === 'string' && v.length > 0,
    `requireOutput: "${key}" must be a non-empty string`
  );
  return v;
}
