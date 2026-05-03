#!/usr/bin/env bun
/**
 * Cursor hook: runs after Agent or Tab edits a file.
 * Auto-formats the edited file with the repo's Prettier so LLM-generated
 * code always lands in the canonical style enforced by `bun run check:format`.
 *
 * Input shape (stdin JSON):
 *   { "file_path": "<absolute path>", "edits": [...] }
 *
 * Behavior:
 * - Skips when there's no file_path or the file no longer exists.
 * - Uses the project-local prettier binary so the version matches CI.
 * - Passes `--ignore-unknown` so files without a prettier parser are skipped.
 * - Prettier respects `.prettierignore` automatically.
 * - Always exits 0; formatting failures must never block the agent.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type HookInput = {
  file_path?: string;
};

const REPO_ROOT = resolve(
  dirname(new URL(import.meta.url).pathname),
  '..',
  '..'
);
const PRETTIER_BIN = resolve(REPO_ROOT, 'node_modules/.bin/prettier');

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function runPrettier(filePath: string): Promise<void> {
  return new Promise((resolveRun) => {
    if (!existsSync(PRETTIER_BIN)) {
      resolveRun();
      return;
    }
    const child = spawn(
      PRETTIER_BIN,
      ['--write', '--ignore-unknown', '--log-level=warn', filePath],
      { cwd: REPO_ROOT, stdio: 'ignore' }
    );
    child.on('close', () => resolveRun());
    child.on('error', () => resolveRun());
  });
}

async function main(): Promise<void> {
  let input: HookInput = {};
  try {
    const raw = await readStdin();
    if (raw.trim().length > 0) {
      input = JSON.parse(raw) as HookInput;
    }
  } catch {
    return;
  }

  const filePath = input.file_path;
  if (!filePath || !existsSync(filePath)) {
    return;
  }

  // Only format files inside this repo so we never touch unrelated paths.
  if (!filePath.startsWith(REPO_ROOT)) {
    return;
  }

  await runPrettier(filePath);
}

await main();
process.exit(0);
