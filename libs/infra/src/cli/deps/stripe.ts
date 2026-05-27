import {
  captureVersion,
  FirstAvailableInstaller,
  GithubReleaseTarballInstaller,
  PackageManagerInstaller,
  verifyRun,
  which,
} from '@pkgs/os';
import { StripeHomebrewInstaller } from './stripe-homebrew-installer';
import type { Dep, DepStatus } from './types';

const UA = 'gamezilla-infra-cli';
const FETCH_TIMEOUT_MS = 15_000;

const installer = new FirstAvailableInstaller(
  [
    new StripeHomebrewInstaller(),
    new PackageManagerInstaller({
      entries: [
        { packageManagerId: 'scoop', package: 'stripe' },
        { packageManagerId: 'winget', package: 'Stripe.StripeCLI' },
      ],
    }),
    new GithubReleaseTarballInstaller({
      repo: 'stripe/stripe-cli',
      binName: 'stripe',
      archive: (version, os) => {
        const arch = os.releaseArchName() === 'arm64' ? 'arm64' : 'x86_64';
        if (os.platform === 'win32') {
          return {
            name: `stripe_${version}_windows_${arch}.zip`,
            format: 'zip',
          };
        }
        return {
          name: `stripe_${version}_${os.releaseOsName()}_${arch}.tar.gz`,
          format: 'tar.gz',
        };
      },
    }),
  ],
  'Install Stripe CLI manually: https://docs.stripe.com/stripe-cli#install'
);

export class StripeDep implements Dep {
  readonly name = 'stripe';
  readonly bin = 'stripe';

  version(): string | null {
    return captureVersion('stripe', ['version']);
  }

  check(): DepStatus {
    if (!which('stripe')) return { ok: false, reason: 'not found on PATH' };
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  }

  async fetchLatestVersion(): Promise<string | null> {
    try {
      const res = await fetch(
        'https://api.github.com/repos/stripe/stripe-cli/releases/latest',
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': UA,
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        }
      );
      if (!res.ok) return null;
      const j = (await res.json()) as { tag_name?: string };
      const tag = j.tag_name?.trim() ?? '';
      const m = /^v?([\d]+\.[\d]+[\w.+-]*)$/.exec(tag);
      return m?.[1]?.trim() ?? null;
    } catch {
      return null;
    }
  }

  install(): void {
    installer.install();
  }

  upgrade(): void {
    installer.upgrade();
  }

  verify(): void {
    verifyRun('stripe', ['version']);
  }
}
