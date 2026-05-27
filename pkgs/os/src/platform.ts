/**
 * Operating system family. Matches Node's `process.platform` for the three
 * platforms `@pkgs/os` supports as first-class citizens.
 */
export type Platform = 'darwin' | 'linux' | 'win32';

/**
 * CPU architecture, normalized to the names GitHub Release archives most
 * commonly use. Maps from Node's `process.arch`.
 */
export type Arch = 'x86_64' | 'arm64';

/**
 * Detect the current platform. Throws on unsupported platforms (e.g. `freebsd`,
 * `openbsd`) rather than silently falling back, so callers don't accidentally
 * ship "POSIX path on aix" bugs.
 */
export function currentPlatform(): Platform {
  const p = process.platform;
  if (p === 'darwin' || p === 'linux' || p === 'win32') return p;
  throw new Error(`Unsupported platform: ${p}`);
}

/**
 * Detect the current CPU architecture. Falls back to `x86_64` on unknown
 * values because every supported platform has an x86_64 binary; arm64 is
 * promoted explicitly when we see it.
 */
export function currentArch(): Arch {
  const a = process.arch;
  if (a === 'arm64') return 'arm64';
  return 'x86_64';
}
