import { assert } from '@gamezilla/shared/assert';
import { BasePipelineCommand } from './base-command';
import { cloudFormation } from './aws';
import type { CiPlatform } from './ci-platform';
import { runStep } from './ci-platform';
import { CDK_BOOTSTRAP_CLOUDFORMATION_EXECUTION_POLICY } from './cdk-bootstrap-flags';
import { CDK_DEPLOY_CONTEXT_ARGS } from './cdk-deploy-context';
import { failWithEvents } from './cfn-shared';
import { diagnoseEcsFailures } from './ecs-diagnostics';
import { AWS_PACKAGE_ROOT } from './paths';
import { run } from './run-subprocess';

export class CdkDeployCommand extends BasePipelineCommand {
  readonly id = 'cdk-deploy';
  readonly summary = 'cdk bootstrap + deploy (aws/)';

  constructor(platform: CiPlatform) {
    super(platform);
  }

  async execute(argv: string[]): Promise<void> {
    assert.array(argv, 'execute: argv must be an array');
    assert.ok(AWS_PACKAGE_ROOT.length > 0, 'execute: AWS_PACKAGE_ROOT must be non-empty');

    await runStep(this.platform, 'CDK bootstrap', () => {
      run(this.platform, 'bunx', [
        'cdk',
        'bootstrap',
        '--cloudformation-execution-policies',
        CDK_BOOTSTRAP_CLOUDFORMATION_EXECUTION_POLICY,
      ], { cwd: AWS_PACKAGE_ROOT, label: 'CDK bootstrap' });
    });

    await runStep(this.platform, 'CDK deploy', () =>
      this.cdkDeployWithDiagnosis()
    );
  }

  private async cdkDeployWithDiagnosis(): Promise<void> {
    try {
      run(
        this.platform,
        'bunx',
        [
          'cdk',
          'deploy',
          ...CDK_DEPLOY_CONTEXT_ARGS,
          '--require-approval',
          'never',
          '--outputs-file',
          'cdk-outputs.json',
          '--progress',
          'events',
        ],
        { cwd: AWS_PACKAGE_ROOT, label: 'CDK deploy' }
      );
      this.platform.notice('CDK deploy finished.');
    } catch {
      this.platform.error('CDK deploy failed — running post-mortem diagnosis…');
      const client = cloudFormation(this.platform);

      try {
        await diagnoseEcsFailures(this.platform, client);
      } catch (diagErr) {
        this.platform.warning(
          `ECS diagnosis could not complete: ${diagErr instanceof Error ? diagErr.message : String(diagErr)}`
        );
      }

      await failWithEvents(
        this.platform,
        client,
        'CDK deploy exited with a non-zero status.',
        'Review the FAILED resources and container logs above. Run "bunx cdk deploy" locally to reproduce, or open the CloudFormation console to inspect the stack events.'
      );
    }
  }
}
