#!/usr/bin/env bun
/**
 * Browser check orchestrator: ensures the preview/dev stack is up, then runs
 * `@libs/integration-test` web UI tests (bun test + @pkgs/ui-testing Playwright driver).
 *
 * When ports :5173 / :8788 are already healthy (`bun dev`, `bun preview`, or CI's
 * prior "Start preview stack" step), runs tests immediately. Otherwise starts
 * `turbo preview` locally, waits for readiness, runs tests, then frees ports.
 *
 * Invoked via `bun run check:browser` (wraps `secrets-run` for dev secrets).
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { join } from 'node:path';

import { ensureDevStackPortsFree } from '../../libs/integration-test/src/ensure-dev-stack-ports-free';
import {
  isLocalE2eStackReadySync,
  waitForLocalE2eStack,
} from '../../libs/integration-test/src/local-e2e-stack';
import { previewStackEnv } from '../../libs/integration-test/src/preview-stack-env';

const REPO_ROOT = join(import.meta.dirname, '../..');
const PREVIEW_LOG = join(REPO_ROOT, '.check-preview-stack.log');

function isCi(): boolean {
  const ci = process.env['CI']?.trim();
  return ci === '1' || ci === 'true';
}

function runE2eTests(): number {
  const result = spawnSync(
    'turbo',
    ['run', 'test:e2e', '--filter=@libs/integration-test'],
    { cwd: REPO_ROOT, stdio: 'inherit', env: process.env }
  );
  return result.status ?? 1;
}

type PreviewHandle = {
  readonly stop: () => void;
  readonly exited: Promise<number>;
};

function startPreviewStack(): PreviewHandle {
  ensureDevStackPortsFree();
  const logFd = openSync(PREVIEW_LOG, 'w');
  const child: ChildProcess = spawn(
    'turbo',
    ['run', 'preview', '--filter=@apps/api', '--filter=@apps/client'],
    {
      cwd: REPO_ROOT,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: { ...process.env, ...previewStackEnv() },
    }
  );
  closeSync(logFd);
  const exited = new Promise<number>((resolve) => {
    child.once('exit', (code) => resolve(code ?? 1));
  });
  child.unref();
  return {
    stop: () => {
      ensureDevStackPortsFree();
    },
    exited,
  };
}

async function waitForStackOrPreviewExit(
  preview: PreviewHandle
): Promise<void> {
  await Promise.race([
    waitForLocalE2eStack(),
    preview.exited.then((code) => {
      throw new Error(
        `[check-browser] turbo preview exited early (code ${String(code)}); see ${PREVIEW_LOG}`
      );
    }),
  ]);
}

async function main(): Promise<void> {
  if (isLocalE2eStackReadySync()) {
    process.exit(runE2eTests());
  }

  if (isCi()) {
    await waitForLocalE2eStack();
    process.exit(runE2eTests());
  }

  process.stdout.write(
    '[check-browser] preview stack not running — starting…\n'
  );
  const preview = startPreviewStack();
  let code = 1;
  try {
    await waitForStackOrPreviewExit(preview);
    code = runE2eTests();
  } finally {
    preview.stop();
  }
  process.exit(code);
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
