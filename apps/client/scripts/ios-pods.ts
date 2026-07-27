/**
 * Keep the CocoaPods install in sync with `node_modules` before an iOS build.
 *
 * bun's store encodes the resolved version in every package path
 * (`node_modules/.bun/<name>@<version>+<hash>/…`), and `pod install` bakes those
 * paths into `Podfile.lock`'s `EXTERNAL SOURCES`. Bumping a native dependency
 * therefore invalidates the recorded paths while leaving `Podfile` untouched, so
 * `expo run:ios` sees no reason to re-pod and Xcode instead fails thousands of
 * lines deep in an rsync/libtool error that names neither the package nor the
 * fix.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** `EXTERNAL SOURCES` entries, quoted (`:path: "../x"`) or bare (`:path: x`). */
const POD_PATH_PATTERN = /^\s*:path:\s*"?([^"\n]+?)"?\s*$/gm;

function log(message: string): void {
  process.stderr.write(`[ios-dev] ${message}\n`);
}

/**
 * `Podfile.lock` pod paths under `node_modules` that no longer exist.
 *
 * Only `node_modules` paths are considered: the remaining entries point at
 * `build/generated`, which Xcode populates during the build and is legitimately
 * absent on a clean checkout.
 */
export function stalePodPaths(iosDir: string): string[] {
  const lockPath = join(iosDir, 'Podfile.lock');
  if (!existsSync(lockPath)) return [];
  const lock = readFileSync(lockPath, 'utf8');
  const stale = new Set<string>();
  for (const [, podPath] of lock.matchAll(POD_PATH_PATTERN)) {
    if (podPath === undefined) continue;
    if (!podPath.includes('node_modules')) continue;
    if (!existsSync(resolve(iosDir, podPath))) stale.add(podPath);
  }
  return [...stale];
}

function runPodInstall(iosDir: string): void {
  const result = spawnSync('pod', ['install'], {
    cwd: iosDir,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error !== undefined) {
    throw new Error(
      `Could not run \`pod install\` in ${iosDir}: ${result.error.message}. Install CocoaPods (\`brew install cocoapods\`) and retry.`
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `\`pod install\` exited with code ${String(result.status ?? 1)}. Fix the error above, then retry.`
    );
  }
}

/** Re-pod when `Podfile.lock` references packages that are no longer installed. */
export function ensurePodsMatchNodeModules(clientRoot: string): void {
  if (process.platform !== 'darwin') return;
  const iosDir = join(clientRoot, 'ios');
  if (!existsSync(iosDir)) return;

  const stale = stalePodPaths(iosDir);
  if (stale.length === 0) return;

  log(
    `Podfile.lock references ${String(stale.length)} package path(s) that no longer exist — a native dependency was upgraded since the last \`pod install\`:`
  );
  for (const podPath of stale) log(`  ${podPath}`);
  log('Running `pod install` to repoint Pods at the installed versions…');
  runPodInstall(iosDir);
}
