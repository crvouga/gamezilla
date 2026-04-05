import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { banner, ok, fail, warn, kv, heading, fmt } from '../fmt';
import { PROJECT_CONFIG } from '../../project-config';
import { ensureAwsEnvCredentials } from '../lib/aws-creds';
import { requireStackOutput } from '../lib/oidc-stack';
import { readTfOutputs } from '../lib/tf-outputs';
import { checkDnsDelegation, CUSTOM_HTTPS_HOSTS } from '../lib/dns';

export class StatusCommand implements Command {
  readonly id = 'status';
  readonly summary = 'Infrastructure status dashboard';
  readonly group = 'main' as const;

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    ensureAwsEnvCredentials();
    const region = PROJECT_CONFIG.aws.region;

    banner('Infrastructure Status');

    heading('AWS Identity');
    try {
      const sts = new STSClient({ region });
      const id = await sts.send(new GetCallerIdentityCommand({}));
      ok('AWS identity', `${id.Arn} (${id.Account})`);
    } catch (e) {
      fail('AWS identity', e instanceof Error ? e.message : String(e));
    }

    heading('OIDC Stack');
    const cfn = new CloudFormationClient({ region });
    try {
      const roleArn = await requireStackOutput(cfn, PROJECT_CONFIG.aws.bootstrapStackName, 'RoleArn');
      ok('OIDC stack', roleArn);
    } catch {
      fail('OIDC stack', 'not found — run "bun run infra bootstrap"');
    }

    heading('Terraform Outputs');
    try {
      const outputs = readTfOutputs(this.platform);
      const keys = Object.keys(outputs);
      ok('Terraform outputs', `${keys.length} outputs`);
      for (const [k, v] of Object.entries(outputs)) {
        if (v) kv(k, v);
      }
    } catch {
      warn('Terraform outputs', 'not available');
    }

    heading('GitHub Variables');
    try {
      const r = Bun.spawnSync(['gh', 'variable', 'list'], {
        stdout: 'pipe',
        stderr: 'pipe',
        env: process.env,
      });
      if (r.exitCode !== 0) {
        warn('GitHub variables', `gh failed (exit ${r.exitCode})`);
      } else {
        ok('GitHub variables');
        const lines = r.stdout.toString().split('\n').filter(Boolean);
        for (const l of lines) {
          console.log(`  ${fmt.dim(l)}`);
        }
      }
    } catch (e) {
      warn('GitHub variables', `${e instanceof Error ? e.message : String(e)}`);
    }

    heading('Domains');
    let domainOutputs: Record<string, string | undefined> = {};
    try {
      domainOutputs = readTfOutputs(this.platform);
    } catch {
      warn('Terraform outputs', 'not available (run terraform apply first)');
    }

    const delegation = checkDnsDelegation(domainOutputs);
    for (const d of delegation.details) {
      if (d.delegated) ok(`${d.domain} NS`, d.message);
      else fail(`${d.domain} NS`, d.message);
    }

    console.log('');
    for (const url of CUSTOM_HTTPS_HOSTS) {
      try {
        const resp = Bun.spawnSync(
          ['curl', '-sI', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '10', url],
          { stdout: 'pipe', stderr: 'pipe' },
        );
        if (resp.exitCode !== 0) {
          fail(url, `curl exited ${resp.exitCode}`);
          continue;
        }
        const code = resp.stdout.toString().trim();
        if (code.startsWith('2') || code.startsWith('3')) {
          ok(url, `HTTP ${code}`);
        } else {
          fail(url, `HTTP ${code}`);
        }
      } catch (e) {
        fail(url, `unreachable: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}
