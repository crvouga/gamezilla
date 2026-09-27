import { spawn } from 'node:child_process';

import { withForcedColorEnv } from '@pkgs/os/force-color-env';

export type FileRunResult = {
  readonly file: string;
  readonly code: number;
  readonly durationMs: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type RunPbtFileArgs = {
  readonly repoRoot: string;
  readonly file: string;
  readonly seed: number;
  readonly numRuns: number;
  readonly sampleInterruptMs: number;
};

function collectStream(stream: NodeJS.ReadableStream | null): Promise<string> {
  if (stream === null) return Promise.resolve('');
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

export function runPbtFile(args: RunPbtFileArgs): Promise<FileRunResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn('bun', ['test', args.file], {
      cwd: args.repoRoot,
      env: withForcedColorEnv({
        ...process.env,
        FC_SEED: String(args.seed),
        PBT_NUM_RUNS: String(args.numRuns),
        PBT_SAMPLE_INTERRUPT_MS: String(args.sampleInterruptMs),
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutP = collectStream(child.stdout);
    const stderrP = collectStream(child.stderr);
    child.on('close', async (code) => {
      const [stdout, stderr] = await Promise.all([stdoutP, stderrP]);
      resolve({
        file: args.file,
        code: code ?? 1,
        durationMs: Date.now() - started,
        stdout,
        stderr,
      });
    });
  });
}
