import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { ok, banner } from '../fmt';
import { runLocal } from '../subprocess';
import { PROJECT_CONFIG } from '../../project-config';

const REQUIRED_CLIS = ['aws', 'gh', 'bun', 'docker', 'terraform'] as const;

export class CheckCommand implements Command {
  readonly id = 'check';
  readonly summary = 'Verify prerequisites (aws, gh, docker, terraform)';
  readonly group = 'main' as const;

  constructor(private readonly platform: CiPlatform) {}

  execute(): void {
    banner('Prerequisite Check');

    for (const cli of REQUIRED_CLIS) {
      requireCliOnPath(cli);
      ok(cli, 'found');
    }

    runLocal('aws', ['sts', 'get-caller-identity']);
    runLocal('gh', ['auth', 'status']);
    runLocal('bun', ['--version']);
    runLocal('docker', ['info', '--format', '{{.ServerVersion}}']);
    runLocal('terraform', ['version']);

    ok('Region', PROJECT_CONFIG.aws.region);
  }
}

function requireCliOnPath(name: string): void {
  const r = Bun.spawnSync(['which', name], { stdout: 'pipe', stderr: 'pipe' });
  if (r.exitCode !== 0) {
    throw new Error(`"${name}" not found on PATH. Install it first.`);
  }
}
