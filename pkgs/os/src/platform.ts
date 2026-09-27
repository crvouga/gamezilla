/**
 * Operating system family. Matches Node's `process.platform` for the three
 * platforms `@pkgs/os` supports as first-class citizens.
 */
export type Platform = 'darwin' | 'linux' | 'win32';

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
