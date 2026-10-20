// @io-wall-ok — compile with Quint, then own the pinned TLC JVM and its files.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { wallStopwatch } from '@pkgs/quint-shared/wall';
import { APALACHE_VERSION, freePort } from './apalache';
import { quintModuleName } from './model-source';
import { runQuint } from './run-quint';
import { QUINT_CLI } from './simulate';
import type { TemporalOptions } from './temporal';
import { temporalStep } from './temporal-step';

/** The same complete proof, with liveness checked once after graph generation. */
export async function runTemporalChecker(input: {
  readonly options: TemporalOptions;
  readonly apalacheHome: string;
  readonly env: Record<string, string>;
  readonly deadlineMs: number;
}) {
  const { options, env, deadlineMs } = input;
  const elapsed = wallStopwatch();
  const module = quintModuleName(options.specPath);
  const tla = join(options.outDir, `${module}.tla`);
  const step = temporalStep(readFileSync(options.specPath, 'utf8'), module);
  const compiled = await runQuint({
    args: [
      QUINT_CLI,
      'compile',
      options.specPath,
      '--main',
      module,
      '--target',
      'tlaplus',
      '--verbosity',
      '0',
      '--apalache-version',
      APALACHE_VERSION,
      '--server-endpoint',
      `127.0.0.1:${String(await freePort())}`,
      '--temporal',
      options.properties.join(','),
      ...(step === undefined ? [] : ['--step', step]),
      ...((options.invariants?.length ?? 0) === 0
        ? []
        : ['--invariant', (options.invariants ?? []).join(' and ')]),
    ],
    cwd: options.outDir,
    env,
    timeoutMs: deadlineMs,
  });
  if (compiled.code !== 0 || compiled.timedOut) return compiled;
  writeFileSync(tla, compiled.stdout);
  const cfg = writeTlcConfig(options, module);
  const args = [
    '-Xmx2048m',
    '-Xms2048m',
    '-Xss8m',
    '-cp',
    join(input.apalacheHome, 'lib/apalache.jar'),
    'tlc2.TLC',
    '-deadlock',
    '-workers',
    '2',
    // Final checks every cycle of the complete graph; intermediate scans
    // consume the proof deadline while repeatedly revisiting old prefixes.
    '-lncheck',
    'final',
    '-config',
    cfg,
    '-metadir',
    join(options.outDir, 'states'),
    tla,
  ];
  writeFileSync(join(options.outDir, 'tlc-command.json'), JSON.stringify(args));
  const checked = await runQuint({
    executable: 'java',
    args,
    cwd: options.outDir,
    env,
    timeoutMs: Math.max(1, deadlineMs - elapsed()),
  });
  const violation =
    checked.code !== null && checked.code >= 10 && checked.code <= 14;
  return {
    ...checked,
    output: `${checked.output}${violation ? '\ncounter-example from TLC\n' : ''}`,
  };
}

function writeTlcConfig(options: TemporalOptions, module: string): string {
  const cfg = join(options.outDir, `${module}.cfg`);
  writeFileSync(
    cfg,
    [
      'INIT q_init',
      'NEXT q_step',
      ...((options.invariants?.length ?? 0) === 0 ? [] : ['INVARIANT q_inv']),
      'PROPERTY q_temporalProps',
      '',
    ].join('\n')
  );
  return cfg;
}
