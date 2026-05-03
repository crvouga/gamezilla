import { captureVersion, spawnInstall, verifyRun, whichSync } from './spawn';
import type { Dep, DepStatus } from './types';

const UA = 'gamezilla-infra-cli';
const FETCH_TIMEOUT_MS = 15_000;

function isMacOS(): boolean {
  return process.platform === 'darwin';
}

function hasHomebrew(): boolean {
  return whichSync('brew');
}

export class StripeDep implements Dep {
  readonly name = 'stripe';
  readonly bin = 'stripe';

  version(): string | null {
    return captureVersion('stripe', ['version']);
  }

  check(): DepStatus {
    if (!whichSync('stripe')) return { ok: false, reason: 'not found on PATH' };
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
    if (isMacOS() && hasHomebrew()) {
      spawnInstall('brew', ['install', 'stripe/stripe-cli/stripe']);
      return;
    }

    throw new Error(
      'Automatic Stripe CLI install requires Homebrew on macOS. ' +
        'Install manually: https://docs.stripe.com/stripe-cli#install'
    );
  }

  upgrade(): void {
    if (isMacOS() && hasHomebrew()) {
      spawnInstall('brew', ['upgrade', 'stripe/stripe-cli/stripe']);
      return;
    }
    this.install();
  }

  verify(): void {
    verifyRun('stripe', ['version']);
  }
}
