import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { assert } from '@gamezilla/shared/assert';
import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { runStep } from '../platform';
import { run, runCapture } from '../subprocess';
import { TF_DEPLOY_VAR_ARGS } from '../lib/tf-vars';
import { TF_PACKAGE_ROOT, REPO_ROOT, INFRA_CLI_ROOT } from '../paths';
import { PROJECT_CONFIG } from '../../project-config';

export class ApplyCommand implements Command {
  readonly id = 'apply';
  readonly summary = 'Docker build, flyctl deploy, terraform apply';
  readonly group = 'ci' as const;
  private readonly tfVarOverrides: readonly string[] | undefined;

  constructor(
    private readonly platform: CiPlatform,
    opts?: { tfVarOverrides?: readonly string[] },
  ) {
    this.tfVarOverrides = opts?.tfVarOverrides;
  }

  async execute(): Promise<void> {
    this.assertDockerDaemon();

    await runStep(this.platform, 'Terraform init', () =>
      this.terraformInit(),
    );
    await runStep(this.platform, 'Terraform apply', () =>
      this.terraformApply(),
    );
    await runStep(this.platform, 'Fly deploy: req-res', () =>
      this.flyDeploy(PROJECT_CONFIG.fly.apps.reqRes, 'req-res.toml'),
    );
    await runStep(this.platform, 'Fly deploy: worker', () =>
      this.flyDeploy(PROJECT_CONFIG.fly.apps.worker, 'worker.toml'),
    );
    await runStep(this.platform, 'Fly deploy: emqx', () =>
      this.flyDeploy(PROJECT_CONFIG.fly.apps.emqx, 'emqx.toml'),
    );
    await runStep(this.platform, 'Set Fly secrets', () =>
      this.setFlySecrets(),
    );
  }

  private assertDockerDaemon(): void {
    if (!existsSync('/var/run/docker.sock')) {
      this.platform.error('Docker socket not found at /var/run/docker.sock.');
      this.platform.error('Fix: Start a Docker-compatible daemon. On macOS: "brew install colima && colima start"');
      assert.fail('deploy: Docker daemon is not running');
    }
  }

  private terraformInit(): void {
    run(this.platform, 'terraform', ['init', '-input=false'], {
      cwd: TF_PACKAGE_ROOT,
      label: 'Terraform init',
    });
  }

  private terraformApply(): void {
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
      ],
      { cwd: TF_PACKAGE_ROOT, label: 'Terraform apply' },
    );
    this.platform.notice('Terraform apply finished.');
  }

  private flyDeploy(appName: string, configFile: string): void {
    const configPath = join(INFRA_CLI_ROOT, 'fly', configFile);
    run(
      this.platform,
      'flyctl',
      [
        'deploy',
        '--config', configPath,
        '--app', appName,
        '--region', PROJECT_CONFIG.fly.region,
        '--remote-only',
        '--wait-timeout', '300',
      ],
      { cwd: REPO_ROOT, label: `Fly deploy ${appName}` },
    );
    this.platform.notice(`Fly deploy ${appName} — OK.`);
  }

  private setFlySecrets(): void {
    const databaseUrl = process.env['DATABASE_URL'];
    const emqxDashboardPassword = process.env['EMQX_DASHBOARD_PASSWORD'];
    const pubsubUrl = `mqtt://${PROJECT_CONFIG.fly.apps.emqx}.internal:1883`;

    for (const appName of [PROJECT_CONFIG.fly.apps.reqRes, PROJECT_CONFIG.fly.apps.worker]) {
      const secrets: Record<string, string> = {
        PUBSUB_URL: pubsubUrl,
      };
      if (databaseUrl) {
        secrets['DATABASE_URL'] = databaseUrl;
      }
      this.setSecrets(appName, secrets);
    }

    const emqxSecrets: Record<string, string> = {};
    if (emqxDashboardPassword) {
      emqxSecrets['EMQX_DASHBOARD__DEFAULT_PASSWORD'] = emqxDashboardPassword;
    }
    this.setSecrets(PROJECT_CONFIG.fly.apps.emqx, emqxSecrets);
  }

  private setSecrets(appName: string, secrets: Record<string, string>): void {
    const args = Object.entries(secrets).map(([k, v]) => `${k}=${v}`);
    if (args.length === 0) return;

    try {
      run(this.platform, 'flyctl', ['secrets', 'set', ...args, '--app', appName, '--stage'], {
        label: `Set secrets on ${appName}`,
      });
    } catch {
      this.platform.warning(`Failed to set secrets on ${appName} — they may already be set.`);
    }
  }
}
