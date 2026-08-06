import type { Writable } from 'node:stream';
import { withForcedColorEnv } from '../force-color-env';
import { combineStreams } from './combine-streams';
import { formatDuration, healLog } from './log';
import type { CheckHealStep } from './steps';

export interface RunStepResult {
  readonly stepId: string;
  readonly bunScript: string;
  readonly exitCode: number;
  readonly output: string;
  readonly durationMs: number;
}

async function mirrorStream(
  stream: ReadableStream<Uint8Array>,
  chunks: Uint8Array[],
  mirror: Writable
): Promise<void> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === undefined) continue;
      chunks.push(value);
      mirror.write(value);
    }
  } finally {
    reader.releaseLock();
  }
}

function concatChunks(chunks: ReadonlyArray<Uint8Array>): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export async function runStep(
  step: CheckHealStep,
  repoRoot: string
): Promise<RunStepResult> {
  const envKeys =
    step.env !== undefined ? Object.keys(step.env).join(', ') : 'none';
  healLog(
    `step ${step.stepId}: starting \`bun run ${step.bunScript}\` (extra env: ${envKeys})`
  );

  const started = Date.now();
  const proc = Bun.spawn(['bun', 'run', step.bunScript], {
    cwd: repoRoot,
    env: withForcedColorEnv({ ...process.env, ...step.env }),
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdoutChunks: Uint8Array[] = [];
  const stderrChunks: Uint8Array[] = [];

  await Promise.all([
    mirrorStream(proc.stdout, stdoutChunks, process.stdout),
    mirrorStream(proc.stderr, stderrChunks, process.stderr),
  ]);

  const exitCode = await proc.exited;
  const durationMs = Date.now() - started;
  const output = combineStreams(
    concatChunks(stdoutChunks),
    concatChunks(stderrChunks)
  );

  if (exitCode === 0) {
    healLog(`step ${step.stepId}: passed (${formatDuration(durationMs)})`);
  } else {
    healLog(
      `step ${step.stepId}: failed exit ${String(exitCode)} (${formatDuration(durationMs)}, ${String(output.length)} chars captured)`
    );
  }

  return {
    stepId: step.stepId,
    bunScript: step.bunScript,
    exitCode,
    output,
    durationMs,
  };
}
