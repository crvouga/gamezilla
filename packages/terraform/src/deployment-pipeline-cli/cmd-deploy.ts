import { existsSync } from 'node:fs';
import { assert } from '@gamezilla/shared/assert';
import { BasePipelineCommand } from './base-command';
import type { CiPlatform } from './ci-platform';
import { runStep } from './ci-platform';
import { TF_DEPLOY_VAR_ARGS } from './tf-deploy-vars';
import { TF_PACKAGE_ROOT, REPO_ROOT } from './paths';
import { run, runCapture } from './run-subprocess';
import { requireAwsRegion } from './aws';

export class DeployCommand extends BasePipelineCommand {
  readonly id = 'deploy';
  readonly summary = 'Docker build+push, terraform init + apply';
  private readonly tfVarOverrides: readonly string[] | undefined;

  constructor(platform: CiPlatform, opts?: { tfVarOverrides?: readonly string[] }) {
    super(platform);
    this.tfVarOverrides = opts?.tfVarOverrides;
  }

  async execute(argv: string[]): Promise<void> {
    assert.array(argv, 'execute: argv must be an array');

    this.assertDockerDaemon();

    const region = requireAwsRegion(this.platform);
    const accountId = await runStep(this.platform, 'Get AWS account ID', () =>
      this.getAccountId(region)
    );

    const appImageUri = `${accountId}.dkr.ecr.${region}.amazonaws.com/gamezilla/app:latest`;
    const emqxImageUri = `${accountId}.dkr.ecr.${region}.amazonaws.com/gamezilla/emqx:latest`;
    const registryUri = `${accountId}.dkr.ecr.${region}.amazonaws.com`;

    await runStep(this.platform, 'Ensure ECR repositories', () =>
      this.ensureEcrRepos(region)
    );
    await runStep(this.platform, 'ECR login', () =>
      this.ecrLogin(registryUri, region)
    );
    await runStep(this.platform, 'Docker build + push (app)', () =>
      this.buildAndPush(REPO_ROOT, 'Dockerfile', appImageUri)
    );
    await runStep(this.platform, 'Docker build + push (emqx)', () =>
      this.buildAndPush(`${TF_PACKAGE_ROOT}/../aws/emqx-image`, 'Dockerfile', emqxImageUri)
    );
    await runStep(this.platform, 'Terraform init', () =>
      this.terraformInit()
    );
    await runStep(this.platform, 'Terraform apply', () =>
      this.terraformApply(appImageUri, emqxImageUri)
    );
  }

  private async getAccountId(region: string): Promise<string> {
    const { GetCallerIdentityCommand, STSClient } = await import('@aws-sdk/client-sts');
    const sts = new STSClient({ region });
    const id = await sts.send(new GetCallerIdentityCommand({}));
    assert.ok(id.Account !== undefined && id.Account.length > 0, 'deploy: AWS account ID required');
    return id.Account as string;
  }

  private ensureEcrRepos(region: string): void {
    for (const repo of ['gamezilla/app', 'gamezilla/emqx']) {
      if (this.ecrRepoExists(repo, region)) {
        this.platform.notice(`ECR repository ${repo} already exists.`);
        continue;
      }
      this.platform.notice(`Creating ECR repository: ${repo}`);
      try {
        run(this.platform, 'aws', [
          'ecr', 'create-repository',
          '--repository-name', repo,
          '--region', region,
          '--image-scanning-configuration', 'scanOnPush=true',
        ], { label: `Create ECR repo ${repo}` });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('RepositoryAlreadyExistsException') || msg.includes('already exists')) {
          this.platform.notice(`ECR repository ${repo} was created concurrently — OK.`);
        } else {
          throw e;
        }
      }
    }
  }

  private ecrRepoExists(repo: string, region: string): boolean {
    try {
      runCapture('aws', ['ecr', 'describe-repositories', '--repository-names', repo, '--region', region]);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('RepositoryNotFoundException') || msg.includes('does not exist')) {
        return false;
      }
      this.platform.warning(`Could not check ECR repo ${repo}: ${msg} — will attempt create.`);
      return false;
    }
  }

  private assertDockerDaemon(): void {
    if (!existsSync('/var/run/docker.sock')) {
      this.platform.error('Docker socket not found at /var/run/docker.sock.');
      this.platform.error('Fix: Start a Docker-compatible daemon. On macOS: "brew install colima && colima start"');
      assert.fail('deploy: Docker daemon is not running — all docker commands will hang without it');
    }
  }

  private async ecrLogin(registryUri: string, region: string): Promise<void> {
    const password = runCapture('aws', [
      'ecr', 'get-login-password', '--region', region,
    ]);
    assert.ok(
      password.length > 0,
      'deploy: aws ecr get-login-password returned empty — check AWS credentials and ecr:GetAuthorizationToken permission',
    );

    const proc = Bun.spawn(
      ['docker', 'login', '--username', 'AWS', '--password-stdin', registryUri],
      { stdout: 'inherit', stderr: 'inherit', stdin: new Blob([password]) },
    );
    const exitCode = await proc.exited;
    assert.ok(exitCode === 0, `deploy: docker login failed (exit ${exitCode})`);
  }

  private buildAndPush(contextDir: string, dockerfile: string, imageUri: string): void {
    run(this.platform, 'docker', [
      'build', '-t', imageUri, '-f', dockerfile, '.',
    ], { cwd: contextDir, label: `Docker build ${imageUri.split('/').pop()}` });

    run(this.platform, 'docker', ['push', imageUri], {
      label: `Docker push ${imageUri.split('/').pop()}`,
    });
  }

  private terraformInit(): void {
    run(this.platform, 'terraform', ['init', '-input=false', '-reconfigure'], {
      cwd: TF_PACKAGE_ROOT,
      label: 'Terraform init',
    });
  }

  private terraformApply(appImageUri: string, emqxImageUri: string): void {
    const varArgs = this.tfVarOverrides ?? TF_DEPLOY_VAR_ARGS;
    run(
      this.platform,
      'terraform',
      [
        'apply',
        '-auto-approve',
        '-input=false',
        '-lock-timeout=120s',
        ...varArgs,
        `-var`, `app_image=${appImageUri}`,
        `-var`, `emqx_image=${emqxImageUri}`,
      ],
      { cwd: TF_PACKAGE_ROOT, label: 'Terraform apply' }
    );
    this.platform.notice('Terraform apply finished.');
  }
}
