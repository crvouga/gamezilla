/* eslint-disable expo/no-dynamic-env-var */
import assert from 'node:assert/strict';
import { BasePipelineCommand } from './base-command';
import { ghError, ghNotice } from './gh';

function isValidAwsAccessKeyId(value: string | undefined): boolean {
  // Typically 20 uppercase letters/digits
  return typeof value === 'string' && /^[A-Z0-9]{20}$/.test(value.trim());
}

function isValidAwsSecretAccessKey(value: string | undefined): boolean {
  // Typically 40 characters, can include letters, digits, /, +
  return typeof value === 'string' && /^[A-Za-z0-9/+=]{40}$/.test(value.trim());
}

function isValidAwsRegion(value: string | undefined): boolean {
  // Example: us-east-1, eu-west-3
  return typeof value === 'string' && /^[a-z]{2}-[a-z]+-\d$/.test(value.trim());
}

export class RequireAwsSecretsCommand extends BasePipelineCommand {
  readonly id = 'require-aws-secrets';
  readonly summary = 'Verify AWS_* env (inject secrets on the step)';

  execute(argv: string[]): void {
    assert(Array.isArray(argv));
    const errors: string[] = [];

    const accessKeyId = process.env['AWS_ACCESS_KEY_ID'];
    const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];
    const region = process.env['AWS_REGION'];

    if (!accessKeyId || !isValidAwsAccessKeyId(accessKeyId)) {
      errors.push('AWS_ACCESS_KEY_ID (expected 20 uppercase letters/digits)');
    }
    if (!secretAccessKey || !isValidAwsSecretAccessKey(secretAccessKey)) {
      errors.push(
        'AWS_SECRET_ACCESS_KEY (expected 40 chars: letters, digits, /, +, =)'
      );
    }
    if (!region || !isValidAwsRegion(region)) {
      errors.push('AWS_REGION (expected format like "us-east-1")');
    }

    if (errors.length > 0) {
      ghError(
        `Missing, empty, or invalid Actions secrets (inject env on this step): ${errors.join(', ')}`
      );
      assert.fail(
        `require-aws-secrets: missing or invalid ${errors.join(', ')} — crash, do not continue`
      );
    }

    assert(errors.length === 0);
    ghNotice('AWS deploy secrets present and valid.');
  }
}
