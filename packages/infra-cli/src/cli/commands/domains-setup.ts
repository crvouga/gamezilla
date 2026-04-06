import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { runStep } from '../platform';
import { run } from '../subprocess';
import { TF_PACKAGE_ROOT } from '../paths';
import { PROJECT_CONFIG } from '../../project-config';

export class DomainsSetupCommand implements Command {
  readonly id = 'domains-setup';
  readonly summary = 'Enable custom domain via Terraform + Fly certs';
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

    await runStep(this.platform, 'Fly.io certs', () => {
      for (const [label, appName] of [
        ['api.gamezilla.app', PROJECT_CONFIG.fly.apps.reqRes],
        ['mqtt.gamezilla.app', PROJECT_CONFIG.fly.apps.emqx],
      ] as const) {
        try {
          run(this.platform, 'flyctl', ['certs', 'add', label, '--app', appName], {
            label: `Fly cert ${label}`,
          });
        } catch {
          this.platform.notice(`Cert for ${label} may already exist — skipping.`);
        }
      }
    });

    this.platform.notice('Domain setup complete. DNS records managed by Cloudflare via Terraform.');
    this.platform.notice('Cloudflare handles TLS automatically for Pages.');
    this.platform.notice('Fly.io TLS certs will be provisioned automatically via ALPN.');
  }
}
