// @io-wall-ok — prepares one immutable model draw for all of a package's spec workers.
import { rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { simulate } from '@pkgs/quint-server/simulate';
import {
  DEFAULT_MAX_STEPS,
  DEFAULT_TRACES,
  findQuintBinding,
} from '@pkgs/quint-shared/registry';
import { type ModelDraw, modelDrawBatches } from './spec-parts';
import { packageSpecs } from './spec-sources';

async function main(): Promise<void> {
  // Exploration draws a fresh seed in each worker; it cannot reuse a prepared pin.
  if (process.env['PBT_RANDOM'] === '1') return;
  const dir = process.cwd();
  const models = packageSpecs(
    dir,
    resolve(import.meta.dirname, '../../..')
  ).filter((path) => path.endsWith('.qnt'));
  if (models.length === 0) return;
  // Loading the bindings registers metadata and actions; no product world is opened.
  const bindings = join(dir, 'tests/quint');
  for (const file of [
    ...new Bun.Glob('**/*.binding.ts').scanSync(bindings),
  ].sort())
    await import(join(bindings, file));
  process.env['HARNESS_REPORT_DIR'] = join(
    dir,
    '.cache/harness-report/prepared'
  );
  const output = join(dir, '.cache/prepared-spec-traces');
  const draws: ModelDraw[] = [];
  for (const path of models) {
    const model = basename(path, '.qnt');
    const binding = findQuintBinding(model);
    // This task only warms draws. The model's test:spec check still requires
    // its binding and fails explicitly; unrelated scenarios need no draw of it.
    if (binding === undefined) {
      console.warn(
        `quint: model ${model} has no binding; test:spec will fail it`
      );
      continue;
    }
    draws.push({
      path,
      traces: binding.traces ?? DEFAULT_TRACES,
      maxSteps: binding.maxSteps ?? DEFAULT_MAX_STEPS,
    });
  }
  const workers = modelDrawBatches(draws).map((batch) =>
    Bun.spawn(
      [process.execPath, import.meta.path, '--draw', JSON.stringify(batch)],
      {
        cwd: dir,
        env: { ...process.env },
        stdout: 'inherit',
        stderr: 'inherit',
      }
    )
  );
  try {
    const codes = await Promise.all(workers.map((worker) => worker.exited));
    if (codes.some((code) => code !== 0))
      throw new Error('Quint preparation failed');
  } finally {
    for (const worker of workers) if (worker.exitCode === null) worker.kill();
    rmSync(output, { recursive: true, force: true });
  }
}

function drawBatch(draws: readonly ModelDraw[]): void {
  const output = join(process.cwd(), '.cache/prepared-spec-traces');
  for (const draw of draws) {
    console.log(`quint: preparing ${basename(draw.path)}`);
    simulate({
      specPath: draw.path,
      traces: draw.traces,
      maxSteps: draw.maxSteps,
      outDir: join(output, basename(draw.path, '.qnt')),
    });
  }
}

if (import.meta.main) {
  if (process.argv[2] === '--draw')
    drawBatch(JSON.parse(process.argv[3]!) as ModelDraw[]);
  else await main();
  // Binding imports may own harness handles; all admitted draws finished above.
  process.exit(0);
}
