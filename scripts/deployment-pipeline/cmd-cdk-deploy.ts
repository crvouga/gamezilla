import assert from 'node:assert/strict';
import { join } from 'node:path';
import { BasePipelineCommand } from './base-command';
import { ghNotice } from './gh';
import { run } from './run-subprocess';

export class CdkDeployCommand extends BasePipelineCommand {
  readonly id = 'cdk-deploy';
  readonly summary = 'bun install + cdk bootstrap + deploy (aws/)';

  execute(argv: string[]): void {
    assert(Array.isArray(argv));
    const awsDir = join(process.cwd(), 'aws');
    assert(awsDir.length > 0);
    run('bun', ['install', '--frozen-lockfile'], { cwd: awsDir });
    run('bunx', ['cdk', 'bootstrap'], { cwd: awsDir });
    run(
      'bunx',
      [
        'cdk',
        'deploy',
        '-c',
        'customDomain=true',
        '-c',
        'customDomainBootstrap=true',
        '--require-approval',
        'never',
        '--outputs-file',
        'cdk-outputs.json',
      ],
      { cwd: awsDir }
    );
    ghNotice('CDK deploy finished.');
  }
}
