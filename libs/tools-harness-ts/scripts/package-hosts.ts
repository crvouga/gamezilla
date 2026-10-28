// @io-wall-ok — reads workspace manifests to place packages on verification hosts.
/**
 * Where a package is verified. A manifest's `"platforms"` names what its code
 * builds for; each platform needs a host that can build it, and a host is a
 * kind of CI runner. Turborepo knows nothing about operating systems, so this
 * is the one place that does:
 *
 * | platform | host    | CI job            |
 * | -------- | ------- | ----------------- |
 * | `linux`  | `linux` | `verify:shards`   |
 * | `macos`  | `macos` | `verify:apple`    |
 * | `ios`    | `macos` | `verify:apple`    |
 *
 * A package without `platforms` (TypeScript on Bun) runs anywhere Bun does
 * and is verified on the `windows` host. A package listing several hosts is
 * verified on each, with `turbo-host-key.json` in its native task inputs so
 * one host's verdict never answers for another's.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const PLATFORMS = {
  linux: { host: 'linux' },
  macos: { host: 'macos' },
  ios: { host: 'macos' },
} as const;

export type Platform = keyof typeof PLATFORMS;
export type Host = (typeof PLATFORMS)[Platform]['host'] | 'windows';

/**
 * The runner each host's CI job starts, and the host key it writes. The
 * Local planning predicts the `macos` job's task hashes from this key, so it must
 * be what that runner reports (`verify-pr.yml` `verify-apple.runs-on`).
 */
export const HOSTS = {
  windows: {
    runner: ['self-hosted', 'Windows', 'X64'],
    platform: 'win32',
    arch: 'x64',
  },
  linux: {
    runner: ['self-hosted', 'Linux', 'X64'],
    platform: 'linux',
    arch: 'x64',
  },
  macos: {
    runner: ['self-hosted', 'macOS', 'ARM64'],
    platform: 'darwin',
    arch: 'arm64',
  },
} as const satisfies Readonly<
  Record<
    Host,
    { runner: readonly string[]; platform: NodeJS.Platform; arch: string }
  >
>;

const DEFAULT_HOSTS: readonly Host[] = ['windows'];

export function isPlatform(value: unknown): value is Platform {
  return typeof value === 'string' && Object.hasOwn(PLATFORMS, value);
}

type Manifest = { readonly name?: string; readonly platforms?: unknown };

/** The hosts that verify a package, from its declared platforms. */
export function hostsOf(manifest: Manifest): readonly Host[] {
  if (!Array.isArray(manifest.platforms)) return DEFAULT_HOSTS;
  const hosts = new Set<Host>();
  for (const platform of manifest.platforms)
    if (isPlatform(platform)) hosts.add(PLATFORMS[platform].host);
  return [...hosts].sort();
}

/** The host this process runs on, or undefined for one no package targets. */
export function currentHost(
  platform: NodeJS.Platform = process.platform
): Host | undefined {
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  if (platform === 'linux') return 'linux';
  return undefined;
}

/** Every workspace manifest under `apps/`, `libs/` and `pkgs/`. */
export function workspaceManifests(root: string): readonly Manifest[] {
  const out: Manifest[] = [];
  for (const tier of ['apps', 'libs', 'pkgs']) {
    const dir = join(root, tier);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir).sort()) {
      const file = join(dir, entry, 'package.json');
      if (existsSync(file))
        out.push(JSON.parse(readFileSync(file, 'utf8')) as Manifest);
    }
  }
  return out;
}

/**
 * Turbo filters that keep a run to the packages `host` verifies: for the
 * default host every workspace package but the ones it cannot build (the
 * Apple-only ones), and for any other host exactly the packages that name it.
 */
export function hostFilters(
  manifests: readonly Manifest[],
  host: Host
): readonly string[] {
  const named = (manifest: Manifest) => manifest.name !== undefined;
  const on = manifests.filter((m) => named(m) && hostsOf(m).includes(host));
  const off = manifests.filter((m) => named(m) && !hostsOf(m).includes(host));
  if (DEFAULT_HOSTS.includes(host))
    return [
      // The workspace tiers, never the root package (whose scripts start turbo).
      '--filter=./apps/*',
      '--filter=./libs/*',
      '--filter=./pkgs/*',
      ...off.map((manifest) => `--filter=!${manifest.name}`),
    ];
  return on.map((manifest) => `--filter=${manifest.name}`);
}

/** The host that verifies undeclared packages and the root-owned gates. */
export function isDefaultHost(host: Host): boolean {
  return DEFAULT_HOSTS.includes(host);
}

export function isHost(value: string): value is Host {
  return Object.hasOwn(HOSTS, value);
}

export const HOST_KEY_FILE = 'turbo-host-key.json';

/**
 * Native tasks hash `turbo-host-key.json` (gitignored): the operating system
 * and CPU their verdict holds for. Toolchain versions are already in the
 * hash through `mise.toml`, and the task wrappers refuse to run on anything
 * but those exact versions.
 */
export function writeHostKey(
  root: string,
  key: { readonly platform: string; readonly arch: string } = {
    platform: process.platform,
    arch: process.arch,
  }
): void {
  writeFileSync(
    join(root, HOST_KEY_FILE),
    `${JSON.stringify({ platform: key.platform, arch: key.arch }, null, 2)}\n`
  );
}
