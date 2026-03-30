import { BaseSetupCommand } from './base-command';
import { PROJECT_CONFIG } from '../project-config';
import { requireCliOnPath, runLocal, runLocalCapture } from './shared';

export class CheckCommand extends BaseSetupCommand {
  readonly id = 'check';
  readonly summary =
    'Verify aws, gh, bun, docker CLIs and auth; print AWS region from config';

  execute(_argv: string[]): void {
    requireCliOnPath('aws');
    requireCliOnPath('gh');
    requireCliOnPath('bun');
    requireCliOnPath('docker');

    console.log('--- aws sts get-caller-identity ---');
    runLocal('aws', ['sts', 'get-caller-identity']);

    console.log('--- gh auth status ---');
    runLocal('gh', ['auth', 'status']);

    console.log('--- bun --version ---');
    runLocal('bun', ['--version']);

    console.log('--- docker info (quiet) ---');
    const d = runLocalCapture('docker', ['info', '-f', '{{.ServerVersion}}']);
    if (!d.ok) {
      throw new Error(
        'Docker daemon not reachable (is Docker running?) — docker info failed'
      );
    }
    console.log(`Docker server version: ${d.stdout.trim()}`);

    console.log(
      `\nPROJECT_CONFIG.aws.region = ${PROJECT_CONFIG.aws.region} (set AWS_REGION / AWS_DEFAULT_REGION to match for AWS CLI)\n`
    );
  }
}
