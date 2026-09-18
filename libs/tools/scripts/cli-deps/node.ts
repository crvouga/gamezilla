import { readFileSync } from 'node:fs';
import { captureVersion, which } from '@pkgs/os';
import { defineCliDep } from './define-cli-dep';
import { REPO_ROOT } from './repo-root';

const NODE_HINT =
  'Install Node.js >=22 (https://nodejs.org/) — required for npm global CLI installs';

function readMinNodeMajor(): number {
  const raw = readFileSync(`${REPO_ROOT}/package.json`, 'utf8');
  const pkg = JSON.parse(raw) as { engines?: { node?: string } };
  const engines = pkg.engines?.node?.trim() ?? '>=22';
  const m = />=?\s*(\d+)/.exec(engines);
  return m?.[1] !== undefined ? Number(m[1]) : 22;
}

export const nodeCliDep = defineCliDep({
  id: 'node',
  installOrUpgrade() {
    const minMajor = readMinNodeMajor();
    if (!which('node')) {
      throw new Error(`node not found on PATH — ${NODE_HINT}`);
    }
    const version = captureVersion('node', ['--version']);
    if (version === null) {
      throw new Error(`could not determine node version — ${NODE_HINT}`);
    }
    const major = Number(version.split('.')[0] ?? '0');
    if (!Number.isFinite(major) || major < minMajor) {
      throw new Error(
        `node ${version} is below required >=${minMajor} — ${NODE_HINT}`
      );
    }
    console.log(`node: ${version}`);
  },
});
