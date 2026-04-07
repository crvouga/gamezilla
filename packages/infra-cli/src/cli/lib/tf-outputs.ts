import { assert } from '@gamezilla/shared/assert';
import { TF_PACKAGE_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { runCapture } from '../subprocess';

export type TfOutputs = Readonly<Record<string, string | undefined>>;

export function readTfOutputs(platform: CiPlatform): TfOutputs {
  let raw: string;
  try {
    raw = runCapture('terraform', ['output', '-json'], {
      cwd: TF_PACKAGE_ROOT,
    });
  } catch (e) {
    platform.error(
      `Failed to read terraform outputs: ${e instanceof Error ? e.message : String(e)}`
    );
    platform.error(
      'Fix: Ensure "terraform apply" ran successfully before this step.'
    );
    assert.fail('readTfOutputs: terraform output -json failed');
  }

  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    platform.error(
      `Failed to parse terraform output JSON: ${e instanceof Error ? e.message : String(e)}`
    );
    assert.fail('readTfOutputs: invalid JSON from terraform output');
  }

  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    platform.error('terraform output -json returned non-object');
    assert.fail('readTfOutputs: expected JSON object');
  }

  const result: Record<string, string | undefined> = {};
  for (const [key, entry] of Object.entries(doc as Record<string, unknown>)) {
    if (typeof entry === 'object' && entry !== null && 'value' in entry) {
      const val = (entry as { value: unknown }).value;
      result[key] = typeof val === 'string' ? val : JSON.stringify(val);
    } else if (typeof entry === 'string') {
      result[key] = entry;
    }
  }

  return result;
}

export function requireOutput(
  platform: CiPlatform,
  outputs: TfOutputs,
  key: string
): string {
  assert.nonEmptyString(key, 'requireOutput: key must be non-empty');
  const v = outputs[key];
  if (v === undefined || v === '' || v === 'null') {
    platform.error(`Terraform output "${key}" missing or empty.`);
    platform.error(
      `Fix: Ensure the Terraform configuration exports "${key}" via output block.`
    );
    assert.fail(`requireOutput: "${key}" must be non-empty`);
  }
  return v;
}
