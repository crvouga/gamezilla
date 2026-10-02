// @io-wall-ok — automated verification adapter; runs the pinned bundled CLI.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { decide, modelEvidence } from '@pkgs/quint/model-evidence';
import { QUINT_CLI } from '@pkgs/quint/simulate';
import { quintSeed } from '@pkgs/quint/wall';
import { CLI_TIMEOUT_MS, modelPath, REPORT_DIR } from './campaign-config';
import { campaignImports } from './campaign-imports';
import { sourceDigest } from './source-digest';

export function quint(
  args: readonly string[],
  executable = process.execPath
): {
  status: number | null;
  output: string;
} {
  const result = spawnSync(executable, [QUINT_CLI, ...args], {
    encoding: 'utf8',
    timeout: CLI_TIMEOUT_MS,
    maxBuffer: 8 * 1024 * 1024,
  });
  return {
    status: result.status,
    output: [result.stdout, result.stderr, result.error?.message]
      .filter(Boolean)
      .join('\n'),
  };
}

export function obligation(
  name: string,
  id: string,
  body: () => string | Promise<string>
) {
  const digest = sourceDigest();
  const records = campaignImports(name).map((module) => ({
    module,
    record: modelEvidence({
      packageName: '@apps/product',
      specPath: modelPath(module),
      specUri: `specs/system/${module}.qnt`,
      reportDir: REPORT_DIR,
    }),
  }));
  return decide({
    record: (result) => {
      for (const target of records)
        target.record({
          ...result,
          id: target.module === name ? result.id : `${result.id}:${name}`,
        });
    },
    id,
    layer: 'specification',
    body: async () => {
      const detail = await body();
      if (sourceDigest() !== digest)
        throw new Error(
          'Model source changed during verification; rerun against a stable source set.'
        );
      return `${detail} Source-set SHA256: ${digest}.`;
    },
  });
}

export function sample(name: string, samples: number, steps: number): string {
  const result = quint([
    'run',
    modelPath(name),
    '--backend',
    'typescript',
    '--invariant',
    'invSafety',
    '--init',
    name === 'recovery' ? 'setup' : 'init',
    '--seed',
    quintSeed(),
    '--max-samples',
    String(samples),
    '--max-steps',
    String(steps),
    '--verbosity',
    '1',
    '--out-itf',
    join(REPORT_DIR, `${name}-last.itf.json`),
  ]);
  if (result.status !== 0 || !result.output.includes('[ok]'))
    throw new Error(result.output);
  return `${samples} seeded traces, at most ${steps} transitions; ${result.output.trim()}`;
}

export function examples(name: string): string {
  const result = quint([
    'test',
    modelPath(name),
    '--backend',
    'typescript',
    '--seed',
    quintSeed(),
    '--match',
    'Test$',
  ]);
  if (result.status !== 0 || !/\d+ passing/.test(result.output))
    throw new Error(result.output);
  return result.output.trim();
}
