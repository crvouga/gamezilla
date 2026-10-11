#!/usr/bin/env bun
// @io-wall-ok — Turbo check entry validates the worker image and its hosting stack.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const image = 'synthetic-population-worker:check';

function run(command: string, args: readonly string[], cwd = root): void {
  const result = spawnSync(command, [...args], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('docker', [
  'build',
  '--file',
  'apps/synthetic-population-worker/Dockerfile',
  '--tag',
  image,
  '.',
]);
run('docker', [
  'run',
  '--rm',
  image,
  'bun',
  'run',
  '--filter',
  '@apps/synthetic-population-worker',
  'test',
]);
