import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { banner, heading, ok } from '../fmt';
import { runLocal, runCapture } from '../subprocess';
import { PROJECT_CONFIG } from '../../project-config';
import { deployOidcStackIdempotent, requireStackOutput } from '../lib/oidc-stack';
import { ensureTfBackend } from '../lib/tf-backend';

export class BootstrapCommand implements Command {
  readonly id = 'bootstrap';
  readonly summary = 'One-time setup: OIDC + state backend + GitHub vars';
  readonly group = 'main' as const;

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Bootstrap');

    heading('Prerequisites');
    for (const cli of ['aws', 'gh', 'bun', 'docker', 'terraform']) {
      requireCliOnPath(cli);
      ok(cli, 'found');
    }

    heading('AWS OIDC Stack');
    process.env['AWS_REGION'] = PROJECT_CONFIG.aws.region;
    const roleArn = await deployOidcStackIdempotent();
    ok('OIDC RoleArn', roleArn);

    heading('Terraform State Backend');
    ensureTfBackend();

    heading('GitHub Variables');
    const client = new CloudFormationClient({ region: PROJECT_CONFIG.aws.region });
    const arn = await requireStackOutput(
      client,
      PROJECT_CONFIG.aws.bootstrapStackName,
      'RoleArn',
    );

    gh(['variable', 'set', 'AWS_ROLE_ARN', '--body', arn]);
    gh(['variable', 'set', 'AWS_REGION', '--body', PROJECT_CONFIG.aws.region]);

    ghQuiet(['secret', 'delete', 'AWS_ACCESS_KEY_ID']);
    ghQuiet(['secret', 'delete', 'AWS_SECRET_ACCESS_KEY']);

    gh(['variable', 'list']);
    ok('GitHub Actions variables set');

    banner('Bootstrap Complete');
    console.log('Next: run "bun run infra deploy" to deploy infrastructure.');
  }
}

function requireCliOnPath(name: string): void {
  const r = Bun.spawnSync(['which', name], { stdout: 'pipe', stderr: 'pipe' });
  if (r.exitCode !== 0) {
    throw new Error(`"${name}" not found on PATH. Install it first.`);
  }
}

function gh(args: string[]): void {
  runLocal('gh', args);
}

function ghQuiet(args: string[]): void {
  try {
    runCapture('gh', args);
  } catch {
    // suppress "not found" style errors
  }
}
