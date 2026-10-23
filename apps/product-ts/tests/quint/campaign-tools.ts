// @io-wall-ok — automated verification adapter; runs the pinned bundled CLI.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { decide, modelEvidence } from '@pkgs/quint-server-ts/model-evidence';
import { QUINT_CLI } from '@pkgs/quint-server-ts/simulate';
import { quintSeed } from '@pkgs/quint-shared-ts/wall';
import { CLI_TIMEOUT_MS, modelPath, REPORT_DIR } from './campaign-config';
import { campaignImports } from './campaign-imports';
import { sourceDigest } from './source-digest';

export async function quint(
  args: readonly string[],
  executable = process.execPath
): Promise<{ status: number | null; output: string }> {
  const child = spawn(executable, [QUINT_CLI, ...args], {
    timeout: CLI_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let overflow = false;
  const append = (chunk: unknown) => {
    output += String(chunk);
    if (Buffer.byteLength(output) > 8 * 1024 * 1024) {
      overflow = true;
      child.kill('SIGKILL');
      output = output.slice(-65536);
    }
  };
  child.stdout!.on('data', append);
  child.stderr!.on('data', append);
  return new Promise((resolve) => {
    child.on('error', (error) =>
      resolve({ status: null, output: `${output}\n${error.message}` })
    );
    child.on('close', (status) =>
      resolve({ status: overflow ? null : status, output })
    );
  });
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
      packageName: '@apps/product-ts',
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

export async function sample(
  name: string,
  samples: number,
  steps: number,
  reportDir = REPORT_DIR
): Promise<string> {
  mkdirSync(reportDir, { recursive: true });
  const result = await quint([
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
    join(reportDir, `${name}-last.itf.json`),
  ]);
  if (result.status !== 0 || !result.output.includes('[ok]'))
    throw new Error(result.output);
  return `${samples} seeded traces, at most ${steps} transitions; ${result.output.trim()}`;
}

export async function examples(name: string): Promise<string> {
  const result = await quint([
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
