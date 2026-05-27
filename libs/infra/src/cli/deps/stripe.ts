import { spawnSync } from 'node:child_process';
import { captureVersion, spawnInstall, verifyRun, whichSync } from './spawn';
import type { Dep, DepStatus } from './types';

const UA = 'gamezilla-infra-cli';
const FETCH_TIMEOUT_MS = 15_000;

function isMacOS(): boolean {
  return process.platform === 'darwin';
}

function isLinux(): boolean {
  return process.platform === 'linux';
}

function hasHomebrew(): boolean {
  return whichSync('brew');
}

function ensureStripeHomebrewTap(): void {
  spawnInstall('brew', ['tap', 'stripe/stripe-cli']);
}

function hasStripeHomebrewFormulaInstalled(): boolean {
  const result = spawnSync(
    'brew',
    ['list', '--formula', 'stripe/stripe-cli/stripe'],
    {
      stdio: 'ignore',
      env: process.env,
    }
  );
  return result.status === 0 && !result.error;
}

function hasLegacyStripeCliFormulaInstalled(): boolean {
  const result = spawnSync('brew', ['list', '--formula', 'stripe-cli'], {
    stdio: 'ignore',
    env: process.env,
  });
  return result.status === 0 && !result.error;
}

function unlinkLegacyStripeCliIfNeeded(): void {
  if (hasLegacyStripeCliFormulaInstalled()) {
    spawnInstall('brew', ['unlink', 'stripe-cli']);
  }
}

function ensureStripeFormulaLinked(): void {
  spawnInstall('brew', ['link', '--overwrite', 'stripe']);
}

function ensureLocalBinOnPath(): void {
  const home = process.env['HOME'];
  if (!home) return;
  const bin = `${home}/.local/bin`;
  // GitHub Actions + most shells already include ~/.local/bin; ensure it for
  // child processes spawned from this CLI too.
  const path = process.env['PATH'] ?? '';
  if (!path.split(':').includes(bin)) {
    process.env['PATH'] = `${bin}:${path}`;
  }
}

function installOrUpgradeStripeCliLinuxLatest(): void {
  ensureLocalBinOnPath();
  spawnInstall('bash', [
    '-lc',
    [
      'set -euo pipefail',
      // Resolve latest tag name via GitHub API (same source as fetchLatestVersion()).
      // Example: {"tag_name":"v1.42.0", ...}
      'TAG="$(curl -fsSL https://api.github.com/repos/stripe/stripe-cli/releases/latest | ' +
        "python3 -c \"import json,sys; print(json.load(sys.stdin).get('tag_name',''))\" )\"",
      'VER="${TAG#v}"',
      'if [ -z "$VER" ]; then echo "Failed to resolve Stripe CLI latest version" 1>&2; exit 1; fi',
      'mkdir -p "$HOME/.local/bin"',
      'curl -fsSL "https://github.com/stripe/stripe-cli/releases/download/v${VER}/stripe_${VER}_linux_x86_64.tar.gz" | tar -xz -C "$HOME/.local/bin" stripe',
      '"$HOME/.local/bin/stripe" version',
    ].join('\n'),
  ]);
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
      ensureStripeHomebrewTap();
      unlinkLegacyStripeCliIfNeeded();
      spawnInstall('brew', ['install', 'stripe/stripe-cli/stripe']);
      ensureStripeFormulaLinked();
      return;
    }

    if (isLinux()) {
      installOrUpgradeStripeCliLinuxLatest();
      return;
    }

    throw new Error(
      'Automatic Stripe CLI install requires Homebrew on macOS. ' +
        'Install manually: https://docs.stripe.com/stripe-cli#install'
    );
  }

  upgrade(): void {
    if (isMacOS() && hasHomebrew()) {
      ensureStripeHomebrewTap();
      unlinkLegacyStripeCliIfNeeded();
      if (hasStripeHomebrewFormulaInstalled()) {
        spawnInstall('brew', ['upgrade', 'stripe/stripe-cli/stripe']);
      } else {
        spawnInstall('brew', ['install', 'stripe/stripe-cli/stripe']);
      }
      ensureStripeFormulaLinked();
      return;
    }
    if (isLinux()) {
      installOrUpgradeStripeCliLinuxLatest();
      return;
    }
    this.install();
  }

  verify(): void {
    verifyRun('stripe', ['version']);
  }
}
