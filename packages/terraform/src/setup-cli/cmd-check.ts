import { BaseSetupCommand } from './base-command';
import { requireCliOnPath, runLocal } from './shared';
import { PROJECT_CONFIG } from '../project-config';

export class CheckCommand extends BaseSetupCommand {
  readonly id = 'check';
  readonly summary = 'Verify aws, gh, bun, docker, terraform; print region';

  execute(): void {
    for (const cli of ['aws', 'gh', 'bun', 'docker', 'terraform']) {
      requireCliOnPath(cli);
      console.log(`✓ ${cli} found`);
    }
    runLocal('aws', ['sts', 'get-caller-identity']);
    runLocal('gh', ['auth', 'status']);
    runLocal('bun', ['--version']);
    runLocal('docker', ['info', '--format', '{{.ServerVersion}}']);
    runLocal('terraform', ['version']);
    console.log(`\nRegion: ${PROJECT_CONFIG.aws.region}`);
  }
}
