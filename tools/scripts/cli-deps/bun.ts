import { readFileSync } from 'node:fs';
import { CurlScriptInstaller, captureVersion, run, which } from '@pkgs/os';
import { defineCliDep, logCliVersion } from './define-cli-dep';
import { REPO_ROOT } from './repo-root';

function readTargetBunVersion(): string {
  const raw = readFileSync(`${REPO_ROOT}/package.json`, 'utf8');
  const pkg = JSON.parse(raw) as { packageManager?: string };
  const pm = pkg.packageManager?.trim() ?? '';
  const m = /^bun@([\d]+\.[\d]+[\w.+-]*)$/.exec(pm);
  if (m?.[1] === undefined) {
    throw new Error(
      `root package.json packageManager must be bun@<semver> (got ${pm || 'missing'})`
    );
  }
  return m[1];
}

export const bunCliDep = defineCliDep({
  id: 'bun',
  installOrUpgrade() {
    const target = readTargetBunVersion();
    if (which('bun')) {
      const current = captureVersion('bun', ['--version']);
      if (current === target) {
        logCliVersion('bun', 'bun');
        return;
      }
      run('bun', ['upgrade', `--version=${target}`]);
    } else {
      new CurlScriptInstaller({
        url: 'https://bun.sh/install',
        scriptArgs: [`bun-v${target}`],
      }).install();
    }
    logCliVersion('bun', 'bun');
  },
});
