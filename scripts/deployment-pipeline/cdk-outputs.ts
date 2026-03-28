import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STACK_NAME } from './cfn-shared';
import { ghError } from './gh';

export type StackOutputs = Readonly<Record<string, string | undefined>>;

export function readCdkOutputs(file?: string): StackOutputs {
  const path = file ?? join(process.cwd(), 'aws', 'cdk-outputs.json');
  assert(typeof path === 'string' && path.length > 0);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    ghError(`Failed to read ${path}: ${String(e)}`);
    assert.fail(`readCdkOutputs: cannot parse ${path}`);
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    ghError('Invalid CDK outputs JSON (expected object)');
    assert.fail('readCdkOutputs: must be a JSON object');
  }

  const doc = raw as Record<string, Record<string, string> | undefined>;
  const stack = doc[STACK_NAME];
  if (stack === undefined || typeof stack !== 'object') {
    ghError(`Missing "${STACK_NAME}" in CDK outputs`);
    assert.fail(`readCdkOutputs: "${STACK_NAME}" key missing`);
  }

  return stack;
}

export function requireOutput(outputs: StackOutputs, key: string): string {
  assert(typeof key === 'string' && key.length > 0);
  const v = outputs[key];
  if (v === undefined || v === '' || v === 'null') {
    ghError(`CDK output "${key}" missing or empty`);
    assert.fail(`requireOutput: "${key}" must be non-empty`);
  }
  assert(typeof v === 'string' && v.length > 0);
  return v;
}
