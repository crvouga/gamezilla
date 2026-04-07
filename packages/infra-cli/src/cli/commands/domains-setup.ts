import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { runStep } from '../platform';
import { run } from '../subprocess';
import { TF_PACKAGE_ROOT } from '../paths';

export class DomainsSetupCommand implements Command {
  readonly id = 'domains-setup';
  readonly summary = 'Enable custom domain via Terraform';
  readonly group = 'domains' as const;

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    await runStep(this.platform, 'Terraform init', () => {
      run(this.platform, 'terraform', ['init', '-input=false'], {
        cwd: TF_PACKAGE_ROOT,
        label: 'Terraform init',
      });
    });

    await runStep(this.platform, 'Terraform apply (custom_domain=true)', () => {
      run(
        this.platform,
        'terraform',
        [
          'apply',
          '-auto-approve',
          '-input=false',
          '-var', 'custom_domain=true',
        ],
        { cwd: TF_PACKAGE_ROOT, label: 'Terraform apply' },
      );
    });

    this.platform.notice('Domain setup complete. DNS records managed by Cloudflare via Terraform.');
    this.platform.notice('Workers custom domains are configured in wrangler.toml.');
    this.platform.notice('Cloudflare handles TLS automatically for Pages and Workers.');
  }
}
