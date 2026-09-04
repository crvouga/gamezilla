import { run } from './command';
import { currentOs } from './current-os';
import type { Installer } from './installer';

export interface CurlScriptInstallerOptions {
  /** Run URL piped through `curl -fsSL <url> | <shell> [extraShellArgs]`. */
  readonly url: string;
  /** Extra args appended after `<shell> -s --` so they reach the install script. */
  readonly scriptArgs?: readonly string[];
  /** Shell to pipe the script into. Default `bash` (some installers require bashisms). */
  readonly shell?: 'bash' | 'sh';
}

/**
 * Install via `curl -fsSL <url> | bash -s -- <scriptArgs>`. Throws on Windows
 * (use a {@link PackageManagerInstaller} or
 * {@link GithubReleaseTarballInstaller} for cross-platform installs).
 *
 * The shell pipeline is built as a single argv to `bash -lc`, not a
 * `child_process.exec` string, so script arguments are quoted safely.
 */
export class CurlScriptInstaller implements Installer {
  constructor(private readonly opts: CurlScriptInstallerOptions) {}

  install(): void {
    this.runScript();
  }

  upgrade(): void {
    this.runScript();
  }

  private runScript(): void {
    if (currentOs().platform === 'win32') {
      throw new Error(
        `curl|bash install script not supported on Windows: ${this.opts.url}`
      );
    }
    const shell = this.opts.shell ?? 'bash';
    const args = (this.opts.scriptArgs ?? [])
      .map((a) => shellQuote(a))
      .join(' ');
    const suffix = args.length > 0 ? ` -s -- ${args}` : '';
    run('bash', [
      '-lc',
      `curl -fsSL ${shellQuote(this.opts.url)} | ${shell}${suffix}`,
    ]);
  }
}

function shellQuote(s: string): string {
  if (/^[\w./:@%+=-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
