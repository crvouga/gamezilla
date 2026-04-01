import { assert } from '@gamezilla/shared/assert';
import { BasePipelineCommand } from './base-command';
import type { CiPlatform } from './ci-platform';
import { CDK_BOOTSTRAP_CLOUDFORMATION_EXECUTION_POLICY } from './cdk-bootstrap-flags';
import { CDK_DEPLOY_CONTEXT_ARGS } from './cdk-deploy-context';
import { AWS_PACKAGE_ROOT } from './paths';
import { run } from './run-subprocess';

export class CdkDeployCommand extends BasePipelineCommand {
  readonly id = 'cdk-deploy';
  readonly summary = 'bun install + cdk bootstrap + deploy (aws/)';

  constructor(platform: CiPlatform) {
    super(platform);
  }

  execute(argv: string[]): void {
    assert.array(argv, 'execute: argv must be an array');
    assert.ok(AWS_PACKAGE_ROOT.length > 0, 'execute: AWS_PACKAGE_ROOT must be non-empty');
    run(this.platform, 'bunx', [
      'cdk',
      'bootstrap',
      '--cloudformation-execution-policies',
      CDK_BOOTSTRAP_CLOUDFORMATION_EXECUTION_POLICY,
    ], { cwd: AWS_PACKAGE_ROOT });
    run(
      this.platform,
      'bunx',
      [
        'cdk',
        'deploy',
        ...CDK_DEPLOY_CONTEXT_ARGS,
        // customDomainBootstrap=false: CI keeps ACM + CloudFront aliases (bootstrap=true is only for `setup domains-bootstrap`).
        '--require-approval',
        'never',
        '--outputs-file',
        'cdk-outputs.json',
      ],
      { cwd: AWS_PACKAGE_ROOT }
    );
    this.platform.notice('CDK deploy finished.');
  }
}
