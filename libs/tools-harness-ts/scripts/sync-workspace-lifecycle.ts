#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Workspace lifecycle fan-out (`bun run workspace:sync`, gate
 * `@libs/tools-harness-ts#ci:workspace-lifecycle`).
 *
 * `libs/tools-harness-ts/workspace/<hook>.sh` is the single source of truth for every
 * workspace lifecycle hook. Each agent orchestrator discovers those hooks in
 * its own config file, so this script projects {@link HOOKS} into every entry
 * of {@link ORCHESTRATORS}. The scripts read nothing orchestrator-specific
 * (see `libs/tools-harness-ts/workspace/lib.sh`), so every tool runs the same commands.
 *
 * Supporting another orchestrator is one entry in {@link ORCHESTRATORS}, then
 * `bun run workspace:sync`. `--check` writes nothing and fails on any drift.
 */
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = join(import.meta.dirname, '../../..');
const SOURCE_DIR = 'libs/tools-harness-ts/workspace';
const SYNC_COMMAND = 'bun run workspace:sync';

/** Lifecycle hooks every orchestrator gets, in config order. Start is only
 * `run` (it prepares a cold workspace itself). There is no setup hook. */
export const HOOKS = ['teardown', 'run'] as const;
export type Hook = (typeof HOOKS)[number];

/** Command an orchestrator runs (from the worktree root) for one hook. */
export function hookCommand(hook: Hook): string {
  return `./${SOURCE_DIR}/${hook}.sh`;
}

export interface Orchestrator {
  name: string;
  docs: string;
  /** Repo-relative config file the orchestrator reads. */
  configPath: string;
  render: (commands: Record<Hook, string>) => unknown;
}

/** `{ "teardown": [...], "run": [...] }`, one command each. */
function commandArrays(commands: Record<Hook, string>): Record<Hook, string[]> {
  return {
    teardown: [commands.teardown],
    run: [commands.run],
  };
}

export const ORCHESTRATORS: Orchestrator[] = [
  {
    name: 'Emdash',
    docs: 'https://emdash.com/docs/project-config',
    configPath: '.emdash.json',
    render: (commands) => ({ scripts: commands }),
  },
  {
    name: 'cmux',
    docs: 'https://cmux.com/docs/custom-commands',
    configPath: '.cmux/cmux.json',
    render: (commands) => ({
      commands: HOOKS.map((hook) => ({
        name: hook === 'run' ? 'Run project' : 'Stop project',
        command: `cd "$(git rev-parse --show-toplevel)" && ${commands[hook]}`,
      })),
    }),
  },
  {
    name: 'Conductor',
    docs: 'https://www.conductor.build/docs/reference/scripts',
    configPath: '.conductor/settings.toml',
    render: (commands) =>
      [
        '"$schema" = "https://conductor.build/schemas/settings.repo.schema.json"',
        '',
        '[scripts]',
        `run = ${JSON.stringify(commands.run)}`,
        `archive = ${JSON.stringify(commands.teardown)}`,
        'run_mode = "nonconcurrent"',
        '',
      ].join('\n'),
  },
  {
    name: 'Superset',
    docs: 'https://docs.superset.sh/setup-teardown-scripts',
    configPath: '.superset/config.json',
    render: commandArrays,
  },
  {
    name: 'super.engineering',
    docs: 'https://super.engineering/docs/project-config-and-scripts/',
    configPath: '.super.engineering/config.json',
    render: commandArrays,
  },
];

interface GeneratedFile {
  path: string;
  content: string;
}

function renderConfig(config: unknown): string {
  return typeof config === 'string'
    ? config
    : `${JSON.stringify(config, null, 2)}\n`;
}

export function renderConfigs(
  orchestrators: Orchestrator[] = ORCHESTRATORS
): GeneratedFile[] {
  const commands = Object.fromEntries(
    HOOKS.map((hook) => [hook, hookCommand(hook)])
  ) as Record<Hook, string>;
  return orchestrators.map((orchestrator) => ({
    path: orchestrator.configPath,
    content: renderConfig(orchestrator.render(commands)),
  }));
}

function verifyHookScripts(errors: string[]): void {
  for (const hook of HOOKS) {
    const path = hookCommand(hook).slice('./'.length);
    try {
      accessSync(join(ROOT, path), constants.X_OK);
    } catch {
      errors.push(`${path}: missing or not executable`);
    }
  }
}

export function syncWorkspaceLifecycle(verify: boolean): {
  errors: string[];
  drift: string[];
} {
  const errors: string[] = [];
  const drift: string[] = [];
  verifyHookScripts(errors);
  for (const file of renderConfigs()) {
    const abs = join(ROOT, file.path);
    const current = existsSync(abs) ? readFileSync(abs, 'utf8') : undefined;
    if (current === file.content) continue;
    drift.push(
      `${file.path} is ${current === undefined ? 'missing' : 'out of date'}`
    );
    if (verify) continue;
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, file.content);
  }
  return { errors, drift };
}

if (import.meta.main) {
  const verify = process.argv.includes('--check');
  const { errors, drift } = syncWorkspaceLifecycle(verify);
  if (errors.length > 0 || (verify && drift.length > 0)) {
    console.error('workspace-lifecycle gate failed:');
    for (const line of [...errors, ...drift]) console.error(`  ${line}`);
    if (verify && drift.length > 0) console.error(`  fix: ${SYNC_COMMAND}`);
    process.exit(1);
  }
  for (const line of drift) console.log(`synced: ${line}`);
  console.log(`ok: orchestrator configs in sync with ${SOURCE_DIR}`);
}
