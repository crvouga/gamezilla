import assert from 'node:assert/strict';
import { BasePipelineCommand } from './base-command';
import { ghNotice } from './gh';
import { AWS_PACKAGE_ROOT } from './paths';
import { run } from './run-subprocess';

export class CdkDeployCommand extends BasePipelineCommand {
  readonly id = 'cdk-deploy';
  readonly summary = 'bun install + cdk bootstrap + deploy (aws/)';

  execute(argv: string[]): void {
    assert(Array.isArray(argv));
    assert(AWS_PACKAGE_ROOT.length > 0);
    run('bunx', ['cdk', 'bootstrap'], { cwd: AWS_PACKAGE_ROOT });
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
      { cwd: AWS_PACKAGE_ROOT }
    );
    ghNotice('CDK deploy finished.');
  }
}
