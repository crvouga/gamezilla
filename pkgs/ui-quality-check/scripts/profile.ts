// @io-wall-ok — sequential configuration sweep with one report, no hidden setup.
import { writeFile } from 'node:fs/promises';
import { benchmark, type CheckerOptions } from '../src/index';

const inputs = process.argv.slice(2);
if (!inputs.length) throw new Error('Provide benchmark video directories.');
const configurations: readonly { name: string; options: CheckerOptions }[] = [
  { name: 'default', options: {} },
  { name: 'batch-1', options: { batchSize: 1 } },
  { name: 'batch-32', options: { batchSize: 32 } },
  { name: 'fps-2', options: { samplingFps: 2 } },
  { name: 'fps-8', options: { samplingFps: 8 } },
  { name: 'no-dedupe', options: { dedupeThreshold: 0 } },
  { name: 'one-decoder', options: { concurrency: 1 } },
  { name: 'four-decoders', options: { concurrency: 4 } },
  { name: 'cpu', options: { provider: 'cpu' } },
];
const results = [];
for (const configuration of configurations) {
  const result = await benchmark(inputs, configuration.options);
  results.push({ name: configuration.name, ...result });
  console.log(
    JSON.stringify({
      name: configuration.name,
      elapsedMs: result.elapsedMs,
      unique: result.framesAnalyzed,
      fps: result.inferenceWindowsPerSecond,
      realtime: result.realtimeFactor,
    })
  );
}
await writeFile('.cache/profile.json', `${JSON.stringify(results, null, 2)}\n`);
