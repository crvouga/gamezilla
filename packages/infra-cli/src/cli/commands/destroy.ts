import { createInterface } from 'node:readline/promises';
import { banner, fmt, heading, ok } from '../lib/fmt';
import { TF_DEPLOY_VAR_ARGS } from '../lib/tf-vars';
import { TF_PACKAGE_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { run } from '../subprocess';
import type { Command } from './types';

export class DestroyCommand implements Command {
  readonly id = 'destroy';
  readonly summary = 'Tear down all infrastructure managed by Terraform';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Destroy');

    if (!process.env['CI']) {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        console.log('');
        console.log(
          fmt.red(fmt.bold('  This will destroy ALL managed infrastructure.'))
        );
        console.log('');
        const answer = await rl.question(
          `  ${fmt.yellow('Type "destroy" to confirm:')} `
        );
        if (answer.trim() !== 'destroy') {
          console.log('');
          ok('Aborted', 'no changes made');
          return;
        }
      } finally {
        rl.close();
      }
    }

    heading('Terraform init');
    await runStep(this.platform, 'Terraform init', () =>
      run(this.platform, 'terraform', ['init', '-input=false'], {
        cwd: TF_PACKAGE_ROOT,
        label: 'Terraform init',
      })
    );

    heading('Terraform destroy');
    await runStep(this.platform, 'Terraform destroy', () =>
      run(
        this.platform,
        'terraform',
        [
          'destroy',
          '-auto-approve',
          '-input=false',
          '-lock-timeout=120s',
          ...TF_DEPLOY_VAR_ARGS,
        ],
        { cwd: TF_PACKAGE_ROOT, label: 'Terraform destroy' }
      )
    );

    banner('Destroy Complete');
    ok('All managed infrastructure has been torn down');
  }
}
