#!/usr/bin/env bun
// @io-wall-ok — composition root

/**
 * `bun install-system`: put the newest release of every tool on this laptop
 * and pin it, so no CLI nags about an available update afterwards.
 *
 * 1. mise itself (`mise self-update`, or `brew upgrade mise` for a Homebrew
 *    install).
 * 2. Every `mise.toml` tool bumped to its latest release (`mise upgrade
 *    --bump --yes`), except the ones in `HELD` below. Confirmation is
 *    answered yes: this runs inside Turborepo's terminal UI, which keeps
 *    the keyboard, so a prompt in the task cannot be accepted.
 * 3. `package.json` `packageManager` set to the Bun mise now pins (Turborepo
 *    reads it; the two must stay equal).
 * 4. `mise install`.
 * 5. The Infisical CLI refreshed to that pin. `mise upgrade` only replaces
 *    mise's copy; a Homebrew formula or a binary earlier on `PATH`
 *    (`~/.local/bin/infisical`) keeps nagging "A new release of infisical is
 *    available". Homebrew is upgraded, and any plain binary on `PATH` is
 *    replaced with the pin. Symlinks (the mise shim, Homebrew's keg) are left
 *    alone.
 * 6. npm tooling (turbo, wrangler, biome, …) updated across every workspace
 *    to the newest release its range allows (`bun update --recursive`), then
 *    `bun install`.
 * 7. What the bumped tools generate or ship for coding agents: the Graphify
 *    skill is rewritten by the release `mise` now pins, and the ast-grep
 *    skills are updated from `ast-grep/agent-skill` (`skills-lock.json`).
 *
 * The bumps land in `mise.toml`, `package.json` files and `bun.lock` — commit
 * them so CI (`jdx/mise-action`, `bun install`) runs the same versions.
 * `@libs/tools#install:cli` stays a plain `mise install` of those pins.
 */
import {
  copyFileSync,
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');

/** Tools pinned to something outside this repo; bump them by hand. */
const HELD: Record<string, string> = {
  'github:emqx/emqx':
    'kept in step with the version pin (libs/pubsub-shared/emqx-deploy/Dockerfile)',
  swift:
    'kept equal to the Swift the pinned Xcode ships ([vars] xcode_version, docs/POLYGLOT.md)',
};

/** Skills from `ast-grep/agent-skill`, refreshed with the ast-grep pin. */
export const AGENT_SKILLS: readonly string[] = ['ast-grep', 'ast-grep-outline'];

export function skillsUpdateCommand(
  skills: readonly string[]
): readonly string[] {
  return [
    'mise',
    'exec',
    '--',
    'bunx',
    'skills',
    'update',
    ...skills,
    '-p',
    '-y',
  ];
}

export function graphifyInstallCommand(): readonly string[] {
  return [
    'mise',
    'exec',
    '--',
    'bun',
    'run',
    'libs/tools/scripts/graphify-install.ts',
  ];
}

/**
 * Homebrew's upgrade ask is on by default and ignores `NONINTERACTIVE`.
 * `HOMEBREW_NO_ASK` is what turns that prompt off. The Turborepo UI keeps
 * the keyboard, so the task cannot answer `[y/n]`.
 */
export const BREW_ENV: Readonly<Record<string, string>> = {
  NONINTERACTIVE: '1',
  HOMEBREW_NO_ASK: '1',
  HOMEBREW_NO_ENV_HINTS: '1',
};

export function brewUpgradeCommand(formula: string): readonly string[] {
  return ['brew', 'upgrade', '--yes', formula];
}

export function miseUpgradeCommand(
  tools: readonly string[]
): readonly string[] {
  return ['mise', 'upgrade', '--bump', '--yes', ...tools];
}

export function miseInstallCommand(): readonly string[] {
  return ['mise', 'install', '--yes'];
}

function run(
  cmd: readonly string[],
  extraEnv?: Readonly<Record<string, string>>
): void {
  console.log(`install-system: $ ${cmd.join(' ')}`);
  const result = Bun.spawnSync([...cmd], {
    cwd: REPO_ROOT,
    stdio: ['inherit', 'inherit', 'inherit'],
    ...(extraEnv === undefined ? {} : { env: { ...process.env, ...extraEnv } }),
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
  if (viaBrew) run(brewUpgradeCommand('mise'), BREW_ENV);
  else run(['mise', 'self-update', '--yes']);
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
  if (bump.length > 0) run(miseUpgradeCommand(bump));
}

/**
 * Point every Infisical the laptop actually runs at the mise pin. A symlink
 * is a shim or a Homebrew keg link; overwriting it would break the manager
 * that owns it.
 */
function updateInfisicalCli(): void {
  const pinned = output(['mise', 'which', 'infisical']);
  if (pinned === undefined) {
    console.error('install-system: ERROR: mise installed no infisical');
    process.exit(1);
  }
  const pinnedReal = realpathSync(pinned);
  const pinnedVersion = output([pinned, '--version']);
  const seen = new Set<string>();
  for (const path of (output(['bash', '-c', 'which -a infisical']) ?? '').split(
    '\n'
  )) {
    if (path.length === 0 || seen.has(path)) continue;
    seen.add(path);
    if (!existsSync(path) || !lstatSync(path).isFile()) continue;
    if (realpathSync(path) === pinnedReal) continue;
    if (output([path, '--version']) === pinnedVersion) continue;
    copyFileSync(pinned, path);
    console.log(`install-system: ${path} → ${pinnedVersion ?? pinned}`);
  }
  if (output(['brew', 'list', '--formula', 'infisical']) !== undefined)
    run(brewUpgradeCommand('infisical'), BREW_ENV);
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

if (import.meta.main) {
  updateMise();
  bumpMiseTools();
  syncPackageManager();
  run(miseInstallCommand());
  updateInfisicalCli();
  run(['mise', 'exec', '--', 'bun', 'update', '--recursive']);
  run(['mise', 'exec', '--', 'bun', 'install']);
  run(graphifyInstallCommand());
  run(skillsUpdateCommand(AGENT_SKILLS));
  console.log(
    'install-system: done — commit mise.toml, package.json files, bun.lock and skills-lock.json'
  );
}
