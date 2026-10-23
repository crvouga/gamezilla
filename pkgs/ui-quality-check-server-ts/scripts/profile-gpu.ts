// @io-wall-ok — optional macOS device profiler; no runtime dependency on platform tools.
import { writeFile } from 'node:fs/promises';
import { wallTimers } from '@pkgs/clock-shared-ts/wall';
import { startProcess } from '@pkgs/os-server-ts/streaming-process';
import { benchmark } from '@pkgs/ui-quality-check-server-ts/benchmark';

if (process.platform !== 'darwin')
  throw new Error(
    'This optional profiler requires macOS ioreg. Use benchmark on other platforms.'
  );
const samples: number[] = [];
let done = false;
const monitor = (async () => {
  while (!done) {
    const child = startProcess({
      command: 'ioreg',
      args: ['-r', '-d', '1', '-c', 'AGXAccelerator'],
    });
    const read = async (stream: AsyncIterable<Uint8Array>) => {
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream) chunks.push(chunk);
      return Buffer.concat(chunks).toString();
    };
    try {
      const [stdout, stderr, code] = await Promise.all([
        read(child.stdout),
        read(child.stderr),
        child.completed,
      ]);
      if (code !== 0) throw new Error(stderr);
      const value = /"Device Utilization %"=(\d+)/.exec(stdout);
      if (value) samples.push(Number(value[1]));
    } finally {
      child.stop();
      await child.completed;
    }
    await new Promise<void>((resolve) => wallTimers.setTimeout(resolve, 250));
  }
})();
void monitor.catch(() => undefined);
try {
  const result = await benchmark(process.argv.slice(2));
  done = true;
  await monitor;
  const report = {
    ...result,
    externalGpu: {
      samples,
      meanPercent: samples.length
        ? samples.reduce((sum, value) => sum + value, 0) / samples.length
        : null,
      maximumPercent: samples.length ? Math.max(...samples) : null,
      scope:
        'Device-global macOS ioreg utilization sampled every 250 ms; includes other GPU users and measurement overhead. Not process-specific occupancy.',
    },
  };
  await writeFile(
    '.cache/gpu-profile.json',
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(report)}\n`);
} finally {
  done = true;
  await monitor;
}
