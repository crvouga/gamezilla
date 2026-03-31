import { CDK_BOOTSTRAP_CLOUDFORMATION_EXECUTION_POLICY } from '../deployment-pipeline-cli/cdk-bootstrap-flags';
import { AWS_PACKAGE_ROOT, runLocal } from './shared';

/** CDK deploy with custom domain flags; writes `cdk-outputs.json` in aws package root. */
export function runCdkDeployCustomDomain(customDomainBootstrap: boolean): void {
  runLocal('bunx', [
    'cdk',
    'bootstrap',
    '--cloudformation-execution-policies',
    CDK_BOOTSTRAP_CLOUDFORMATION_EXECUTION_POLICY,
  ], { cwd: AWS_PACKAGE_ROOT });
  runLocal(
    'bunx',
    [
      'cdk',
      'deploy',
      '-c',
      'customDomain=true',
      '-c',
      `customDomainBootstrap=${customDomainBootstrap}`,
      '--require-approval',
      'never',
      '--outputs-file',
      'cdk-outputs.json',
    ],
    { cwd: AWS_PACKAGE_ROOT }
  );
}
