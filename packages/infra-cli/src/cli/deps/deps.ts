export interface Dep {
  /** Display name shown in check/install output. */
  readonly name: string;
  /** Shell command name (what we look for on PATH). */
  readonly bin: string;
  /** Returns the installed version string, or null if not installed. */
  version(): string | null;
  /** Returns true when the dep is installed and meets the minimum version. */
  check(): DepStatus;
  /** Installs or upgrades the dep. Throws on failure. */
  install(): void;
  /** Optional verification command(s) to run after check passes (e.g. `wrangler whoami`). */
  verify?(): void;
}

export type DepStatus =
  | { readonly ok: true; readonly version: string }
  | { readonly ok: false; readonly reason: string };

function whichSync(bin: string): boolean {
  const r = Bun.spawnSync(['which', bin], { stdout: 'pipe', stderr: 'pipe' });
  return r.exitCode === 0;
}

function captureVersion(bin: string, args: string[]): string | null {
  try {
    const r = Bun.spawnSync([bin, ...args], { stdout: 'pipe', stderr: 'pipe' });
    if (r.exitCode !== 0) return null;
    const out = r.stdout.toString().trim();
    const match = out.match(/[\d]+\.[\d]+[\w.+-]*/);
    return match ? match[0] : out.split('\n')[0]!.trim();
  } catch {
    return null;
  }
}

function spawnInstall(cmd: string, args: string[]): void {
  const r = Bun.spawnSync([cmd, ...args], {
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
    env: process.env,
  });
  if (r.exitCode !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.exitCode}`);
  }
}

function verifyRun(bin: string, args: string[]): void {
  const r = Bun.spawnSync([bin, ...args], {
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
    env: process.env,
  });
  if (r.exitCode !== 0) {
    throw new Error(`${bin} ${args.join(' ')} exited ${r.exitCode}`);
  }
}

// ---------------------------------------------------------------------------
// Implementations
// ---------------------------------------------------------------------------

export const WranglerDep: Dep = {
  name: 'wrangler',
  bin: 'wrangler',
  version: () => captureVersion('wrangler', ['--version']),
  check() {
    if (!whichSync('wrangler'))
      return { ok: false, reason: 'not found on PATH' };
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  },
  install() {
    spawnInstall('bun', ['add', '-g', 'wrangler']);
  },
  verify() {
    verifyRun('wrangler', ['whoami']);
  },
};

export const TerraformDep: Dep = {
  name: 'terraform',
  bin: 'terraform',
  version: () => captureVersion('terraform', ['version']),
  check() {
    if (!whichSync('terraform'))
      return { ok: false, reason: 'not found on PATH' };
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  },
  install() {
    spawnInstall('brew', ['install', 'hashicorp/tap/terraform']);
  },
  verify() {
    verifyRun('terraform', ['version']);
  },
};

export const BunDep: Dep = {
  name: 'bun',
  bin: 'bun',
  version: () => captureVersion('bun', ['--version']),
  check() {
    if (!whichSync('bun')) return { ok: false, reason: 'not found on PATH' };
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  },
  install() {
    spawnInstall('bash', ['-c', 'curl -fsSL https://bun.sh/install | bash']);
  },
  verify() {
    verifyRun('bun', ['--version']);
  },
};

export const DopplerDep: Dep = {
  name: 'doppler',
  bin: 'doppler',
  version: () => captureVersion('doppler', ['--version']),
  check() {
    if (!whichSync('doppler'))
      return { ok: false, reason: 'not found on PATH' };
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  },
  install() {
    spawnInstall('brew', ['install', 'dopplerhq/cli/doppler']);
  },
  verify() {
    verifyRun('doppler', ['--version']);
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const ALL_DEPS: readonly Dep[] = [
  WranglerDep,
  TerraformDep,
  BunDep,
  DopplerDep,
];
