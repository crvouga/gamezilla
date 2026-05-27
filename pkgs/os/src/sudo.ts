import { run, which } from './command';

/**
 * Run `cmd` with privileges. If the current process is already root, runs
 * directly; otherwise prepends `sudo` (if available). This mirrors what a
 * developer would type by hand for `apt-get install` / `dnf install` /
 * `pacman -S` and keeps non-root developers' install commands working.
 */
export function runAsRoot(cmd: string, args: readonly string[]): void {
  if (process.getuid?.() === 0) {
    run(cmd, args);
    return;
  }
  if (!which('sudo')) {
    throw new Error(
      `${cmd} requires root; install sudo or rerun as root: ${cmd} ${args.join(' ')}`
    );
  }
  run('sudo', [cmd, ...args]);
}
