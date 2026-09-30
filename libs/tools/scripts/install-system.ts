#!/usr/bin/env bun
// @io-wall-ok — composition root

/**
 * `bun install-system`: put the newest release of every tool on this laptop
 * and pin it, so no CLI nags about an available update afterwards.
 *
 * 1. mise itself (`mise self-update`, or `brew upgrade mise` for a Homebrew
 *    install).
 * 2. Every `mise.toml` tool bumped to its latest release (`mise upgrade
 *    --bump`), except the ones in `HELD` below.
 * 3. `package.json` `packageManager` set to the Bun mise now pins (Turborepo
 *    reads it; the two must stay equal).
 * 4. npm tooling (turbo, wrangler, biome, …) updated across every workspace
 *    to the newest release its range allows (`bun update --recursive`).
 * 5. `mise install` + `bun install`.
 *
 * The bumps land in `mise.toml`, `package.json` files and `bun.lock` — commit
 * them so CI (`jdx/mise-action`, `bun install`) runs the same versions.
 * `@libs/tools#install:cli` stays a plain `mise install` of those pins.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');

/** Tools pinned to something outside this repo; bump them by hand. */
const HELD: Record<string, string> = {
  'github:emqx/emqx':
    'kept in step with the version pin (libs/pubsub/emqx-deploy/Dockerfile)',
};

function run(cmd: readonly string[]): void {
  console.log(`install-system: $ ${cmd.join(' ')}`);
  const result = Bun.spawnSync([...cmd], {
    cwd: REPO_ROOT,
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  if (result.exitCode !== 0) {
    console.error(`install-system: ERROR: \`${cmd.join(' ')}\` failed`);
    process.exit(result.exitCode ?? 1);
  }
}

function output(cmd: readonly string[]): string | undefined {
  const result = Bun.spawnSync([...cmd], { cwd: REPO_ROOT, stderr: 'pipe' });
  return result.exitCode === 0 ? result.stdout.toString().trim() : undefined;
}

function updateMise(): void {
  const viaBrew =
    output(['brew', '--prefix']) !== undefined &&
    output(['brew', 'list', '--formula', 'mise']) !== undefined;
  run(viaBrew ? ['brew', 'upgrade', 'mise'] : ['mise', 'self-update', '--yes']);
}

function bumpMiseTools(): void {
  const tools = Object.keys(
    JSON.parse(output(['mise', 'ls', '--local', '--json']) ?? '{}') as Record<
      string,
      unknown
    >
  );
  for (const [tool, reason] of Object.entries(HELD)) {
    if (tools.includes(tool))
      console.log(`install-system: holding ${tool} — ${reason}`);
  }
  const bump = tools.filter((tool) => !(tool in HELD));
  if (bump.length > 0) run(['mise', 'upgrade', '--bump', ...bump]);
}

function syncPackageManager(): void {
  const bun = output(['mise', 'current', 'bun']);
  if (bun === undefined) {
    console.error('install-system: ERROR: mise pins no bun');
    process.exit(1);
  }
  const path = join(REPO_ROOT, 'package.json');
  const text = readFileSync(path, 'utf8');
  const next = text.replace(
    /"packageManager": "bun@[^"]*"/,
    `"packageManager": "bun@${bun}"`
  );
  if (next !== text) {
    writeFileSync(path, next);
    console.log(`install-system: packageManager → bun@${bun}`);
  }
}

updateMise();
bumpMiseTools();
syncPackageManager();
run(['mise', 'install']);
run(['mise', 'exec', '--', 'bun', 'update', '--recursive']);
run(['mise', 'exec', '--', 'bun', 'install']);
console.log(
  'install-system: done — commit mise.toml, package.json files and bun.lock'
);
