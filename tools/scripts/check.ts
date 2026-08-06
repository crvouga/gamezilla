/**
 * Local orchestrator mirroring every gate job in
 * `.github/workflows/deployment-pipeline.yml` (`deploy.needs`).
 * Runs the six lanes in parallel so wall time matches the GHA fan-out.
 *
 * On failure, writes agent-facing artifacts under `check/`:
 *   - `check/llm-fix-prompt.md` — full fix prompt with per-lane logs
 *   - `check/failures.json` — machine-readable index of failed steps
 * An LLM agent can read those and fix every failure in one pass.
 */
import { join } from 'node:path';
import type { Writable } from 'node:stream';
import { DEPLOYMENT_PIPELINE_CHECK_STEPS } from '../../libs/infra/src/cli/lib/deployment-pipeline-check-steps';
import {
  CHECK_FAILURES_JSON_REL,
  CHECK_LLM_FIX_PROMPT_REL,
  clearCheckFailureArtifact,
  writeCheckFailureArtifact,
  type CheckStepFailure,
} from './check-failure-artifact';
import { combineStreams } from './check-heal/combine-streams';
import { withForcedColorEnv } from './force-color-env';

const REPO_ROOT = join(import.meta.dirname, '../..');

interface LaneResult {
  readonly stepId: string;
  readonly bunScript: string;
  readonly exitCode: number;
  readonly output: string;
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

function laneEnv(bunScript: string): NodeJS.ProcessEnv {
  const env = withForcedColorEnv();
  if (bunScript.startsWith('check:ci:')) {
    env['TURBO_OUTPUT_LOGS'] = 'errors-only';
  }
  return env;
}

async function runLane(stepId: string, bunScript: string): Promise<LaneResult> {
  const proc = Bun.spawn(['bun', 'run', bunScript], {
    cwd: REPO_ROOT,
    env: laneEnv(bunScript),
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
  return {
    stepId,
    bunScript,
    exitCode: exitCode ?? 1,
    output: combineStreams(
      concatChunks(stdoutChunks),
      concatChunks(stderrChunks)
    ),
  };
}

function toFailures(results: ReadonlyArray<LaneResult>): CheckStepFailure[] {
  return results
    .filter((r) => r.exitCode !== 0)
    .map((r) => ({
      stepId: r.stepId,
      bunScript: r.bunScript,
      exitCode: r.exitCode,
      output: r.output,
    }));
}

const results = await Promise.all(
  DEPLOYMENT_PIPELINE_CHECK_STEPS.map((s) => runLane(s.jobId, s.bunScript))
);
const failures = toFailures(results);

if (failures.length === 0) {
  await clearCheckFailureArtifact(REPO_ROOT);
  process.exit(0);
}

const { promptPath } = await writeCheckFailureArtifact(REPO_ROOT, failures);
const failedIds = failures.map((f) => f.stepId).join(', ');
console.error(`check: failed: ${failedIds}`);
console.error(
  `check: agent fix artifact → ${CHECK_LLM_FIX_PROMPT_REL} (index: ${CHECK_FAILURES_JSON_REL})`
);
console.error(`check: absolute path → ${promptPath}`);
process.exit(1);
