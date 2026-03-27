import assert from 'node:assert/strict';
import { BasePipelineCommand } from './base-command';
import { ghError, ghNotice } from './gh';

export class RequireAwsSecretsCommand extends BasePipelineCommand {
  readonly id = 'require-aws-secrets';
  readonly summary =
    'Verify AWS_* env (inject secrets on the step)';

  execute(argv: string[]): void {
    assert(Array.isArray(argv));
    const missing: string[] = [];
    if (
      process.env['AWS_ACCESS_KEY_ID'] === undefined ||
      String(process.env['AWS_ACCESS_KEY_ID']).trim() === ''
    ) {
      missing.push('AWS_ACCESS_KEY_ID');
    }
    if (
      process.env['AWS_SECRET_ACCESS_KEY'] === undefined ||
      String(process.env['AWS_SECRET_ACCESS_KEY']).trim() === ''
    ) {
      missing.push('AWS_SECRET_ACCESS_KEY');
    }
    if (
      process.env['AWS_REGION'] === undefined ||
      String(process.env['AWS_REGION']).trim() === ''
    ) {
      missing.push('AWS_REGION');
    }
    if (missing.length > 0) {
      ghError(
        `Missing or empty Actions secrets (inject env on this step): ${missing.join(', ')}`
      );
      assert.fail(
        `require-aws-secrets: missing ${missing.join(', ')} — crash, do not continue`
      );
    }
    assert(missing.length === 0);
    ghNotice('AWS deploy secrets present.');
  }
}
