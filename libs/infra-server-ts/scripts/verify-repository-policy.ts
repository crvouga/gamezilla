#!/usr/bin/env bun
// @io-wall-ok — offline gate entry; tools are installed by CI setup.
import { join } from 'node:path';
import { tofuLayout } from '@libs/infra-server-ts/tofu-layout';

const { policyDir, paths } = tofuLayout(join(import.meta.dirname, '..'));
const commands = [
  ['conftest', 'verify', '--policy', policyDir],
  ['conftest', 'fmt', '--check', policyDir],
  ['tofu', 'fmt', '-check', join(paths.tofuDir, 'modules', 'repository')],
];
for (const [tool, ...args] of commands) {
  if (!tool) throw new Error('Missing policy verification tool');
  const selected = Bun.spawnSync(['mise', 'which', tool], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (selected.exitCode !== 0)
    throw new Error(
      `CI setup must install ${tool}: ${selected.stderr.toString()}`
    );
  const result = Bun.spawnSync([selected.stdout.toString().trim(), ...args], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (result.exitCode !== 0) process.exit(result.exitCode);
}
