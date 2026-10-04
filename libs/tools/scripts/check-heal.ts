#!/usr/bin/env bun
/**
 * Agentic loop: run `bun check:local` gates, invoke Cursor CLI agent to fix failures,
 * repeat until green or `--max-iterations` is hit.
 *
 * Requires CURSOR_API_KEY from the secret store (`bun run check:heal` uses secrets-run).
 */
import { join } from 'node:path';
import {
  describeApiKeySource,
  invokeAgent,
  requireApiKey,
} from './invoke-agent';
import { formatDuration, healLog } from './log';
import { buildCheckHealPromptBody } from './prompt';
import { runStep } from './run-step';
import { CHECK_HEAL_STEPS } from './steps';

const REPO_ROOT = join(import.meta.dirname, '../../..');

interface CheckHealCli {
  readonly maxIterations: number;
  readonly dryRun: boolean;
  readonly model?: string;
  readonly apiKey?: string;
}

interface StepFailure {
  readonly stepId: string;
  readonly output: string;
}

function parseCli(argv: ReadonlyArray<string>): CheckHealCli {
  let maxIterations = 8;
  let dryRun = false;
  let model: string | undefined;
  let apiKey: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--max-iterations') {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error('--max-iterations requires a number');
      }
      maxIterations = Number.parseInt(next, 10);
      if (!Number.isFinite(maxIterations) || maxIterations < 1) {
        throw new Error('--max-iterations must be a positive integer');
      }
      i++;
      continue;
    }
    if (arg === '--model') {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error('--model requires a value');
      }
      model = next;
      i++;
      continue;
    }
    if (arg === '--api-key') {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error('--api-key requires a value');
      }
      apiKey = next;
      i++;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    maxIterations,
    dryRun,
    ...(model !== undefined ? { model } : {}),
    ...(apiKey !== undefined ? { apiKey } : {}),
  };
}

function printUsage(): void {
  process.stdout.write(
    [
      'Usage: bun run check:heal [-- OPTIONS]',
      '',
      'Options:',
      '  --max-iterations N  Stop after N heal attempts (default: 8)',
      '  --dry-run           Run checks and print prompt; do not invoke agent',
      '  --model MODEL       Cursor model id (optional)',
      '  --api-key KEY       Cursor API key (default: CURSOR_API_KEY from secret store dev config)',
      '  -h, --help          Show this help',
      '',
    ].join('\n')
  );
}

async function runCheckSteps(): Promise<StepFailure[]> {
  const failures: StepFailure[] = [];
  healLog(
    `running ${String(CHECK_HEAL_STEPS.length)} check step(s): ${CHECK_HEAL_STEPS.map((s) => s.stepId).join(' → ')}`
  );

  for (const step of CHECK_HEAL_STEPS) {
    const result = await runStep(step, REPO_ROOT);
    if (result.exitCode !== 0) {
      failures.push({
        stepId: result.stepId,
        output: result.output,
      });
    }
  }

  return failures;
}

function formatFailureSummary(failures: ReadonlyArray<StepFailure>): string {
  return failures.map((f) => f.stepId).join(', ');
}

function logFailurePreview(failures: ReadonlyArray<StepFailure>): void {
  for (const f of failures) {
    const lines = f.output.split('\n');
    const preview = lines.slice(-8).join('\n').trimEnd();
    healLog(
      `failure preview (${f.stepId}, last ${String(Math.min(8, lines.length))} lines):`
    );
    for (const line of preview.split('\n')) {
      process.stderr.write(`  ${line}\n`);
    }
  }
}

async function main(): Promise<void> {
  let cli: CheckHealCli;
  try {
    cli = parseCli(process.argv.slice(2));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`check:heal: ${msg}`);
    printUsage();
    process.exit(1);
  }

  healLog(`repo=${REPO_ROOT}`);
  healLog(
    `config: maxIterations=${String(cli.maxIterations)} dryRun=${String(cli.dryRun)} model=${cli.model ?? 'default'}`
  );

  let resolvedApiKey: string | undefined;
  if (!cli.dryRun) {
    try {
      resolvedApiKey = requireApiKey(cli.apiKey);
      healLog(
        `api key: ${describeApiKeySource(cli.apiKey)} (${resolvedApiKey.slice(0, 8)}…)`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`check:heal: ${msg}`);
      process.exit(1);
    }
  } else {
    healLog('dry-run: agent will not be invoked');
  }

  for (let iteration = 1; iteration <= cli.maxIterations; iteration++) {
    process.stdout.write(
      `\ncheck:heal iteration ${String(iteration)}/${String(cli.maxIterations)}\n`
    );
    healLog(
      `iteration ${String(iteration)}/${String(cli.maxIterations)} begin`
    );

    const checkStarted = Date.now();
    const failures = await runCheckSteps();
    healLog(
      `checks finished in ${formatDuration(Date.now() - checkStarted)} — ${String(failures.length)} failure(s)`
    );

    if (failures.length === 0) {
      healLog('all `bun check:local` gates passed');
      process.stdout.write('All `bun check:local` gates passed.\n');
      process.exit(0);
    }

    process.stdout.write(
      `${String(failures.length)} failing step(s): ${formatFailureSummary(failures)}\n`
    );
    logFailurePreview(failures);

    const prompt = buildCheckHealPromptBody(failures);
    healLog(`built fix prompt (${String(prompt.length)} chars)`);

    if (cli.dryRun) {
      process.stdout.write('\n--- dry-run prompt ---\n\n');
      process.stdout.write(`${prompt}\n`);
      process.exit(1);
    }

    const agentResult = await invokeAgent({
      prompt,
      workspace: REPO_ROOT,
      apiKey: resolvedApiKey!,
      continueSession: iteration > 1,
      ...(cli.model !== undefined ? { model: cli.model } : {}),
    });

    if (agentResult.exitCode !== 0) {
      console.error(
        `check:heal: agent exited with code ${String(agentResult.exitCode)}`
      );
      process.exit(agentResult.exitCode);
    }

    healLog(`iteration ${String(iteration)} complete — re-running checks`);
  }

  console.error(
    `check:heal: still failing after ${String(cli.maxIterations)} iteration(s). Re-run or increase --max-iterations.`
  );
  process.exit(1);
}

void main();
