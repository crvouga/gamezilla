#!/usr/bin/env bun

// @io-wall-ok — composition root
/**
 * Agent-command fan-out (`bun run agents:sync`, gate `@libs/tools-harness-ts#ci:agent-commands`).
 *
 * `.agents/commands/<name>.md` is the single source of truth for every slash
 * command. Each AI coding harness discovers commands in its own directory and
 * format, so this script projects every source file into each one:
 *
 * - Claude Code, Cursor, OpenCode, Factory, Roo Code and Cline workflows
 *   read markdown commands from their respective directories,
 *   so their directory is a symlink to `.agents/commands`.
 * - Gemini CLI (`.gemini/commands/<name>.toml`) injects the source with
 *   `@{…}`.
 * - GitHub Copilot (`.github/prompts/<name>.prompt.md`), Windsurf
 *   (`.windsurf/workflows/<name>.md`, capped at 12k chars) and Codex skills
 *   (`.agents/skills/<name>/SKILL.md`) get a generated stub that points the
 *   agent at the source file.
 *
 * Generated stubs carry {@link GENERATED_MARKER}; stale stubs are removed.
 * The same run writes instruction pointers (`./sync-agent-instructions.ts`)
 * and each harness's MCP server entry (`./sync-agent-mcp.ts`).
 * `--check` writes nothing and fails on any drift.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import { syncAgentInstructions } from './sync-agent-instructions';
import { syncAgentMcp } from './sync-agent-mcp';

const ROOT = join(import.meta.dirname, '../../..');
const SOURCE_DIR = '.agents/commands';
const SYNC_COMMAND = 'bun run agents:sync';
export const GENERATED_MARKER = `generated from ${SOURCE_DIR} by \`${SYNC_COMMAND}\` — do not edit`;

/** Harness command directories that are symlinks to {@link SOURCE_DIR}. */
const SYMLINK_DIRS = [
  '.claude/commands',
  '.cursor/commands',
  '.opencode/commands',
  '.factory/commands',
  '.roo/commands',
  '.clinerules/workflows',
];

export interface AgentCommand {
  name: string;
  description: string;
}

interface GeneratedFile {
  path: string;
  content: string;
}

interface StubTarget {
  /** Directory whose marker-carrying files this target owns. */
  dir: string;
  /** Repo-relative output path for one command. */
  pathFor: (name: string) => string;
  render: (command: AgentCommand) => string;
}

function sourcePath(name: string): string {
  return `${SOURCE_DIR}/${name}.md`;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function pointerBody(name: string, sourceLink: string): string {
  return [
    `Run the \`/${name}\` command. Its single source of truth is ${sourceLink}.`,
    '',
    'Read that file in full now and follow it exactly. Treat any text the user',
    'typed after the command as its arguments.',
    '',
  ].join('\n');
}

const STUB_TARGETS: StubTarget[] = [
  {
    dir: '.gemini/commands',
    pathFor: (name) => `.gemini/commands/${name}.toml`,
    render: (command) =>
      [
        `# ${GENERATED_MARKER}`,
        `description = ${JSON.stringify(command.description)}`,
        `prompt = """`,
        `@{${sourcePath(command.name)}}`,
        '',
        'Follow the command above exactly. Arguments: {{args}}',
        '"""',
        '',
      ].join('\n'),
  },
  {
    dir: '.github/prompts',
    pathFor: (name) => `.github/prompts/${name}.prompt.md`,
    render: (command) =>
      [
        '---',
        `description: ${yamlString(command.description)}`,
        'agent: agent',
        '---',
        '',
        `<!-- ${GENERATED_MARKER} -->`,
        '',
        pointerBody(
          command.name,
          `[${sourcePath(command.name)}](../../${sourcePath(command.name)})`
        ),
      ].join('\n'),
  },
  {
    dir: '.windsurf/workflows',
    pathFor: (name) => `.windsurf/workflows/${name}.md`,
    render: (command) =>
      [
        '---',
        `description: ${yamlString(command.description)}`,
        '---',
        '',
        `<!-- ${GENERATED_MARKER} -->`,
        '',
        pointerBody(command.name, `\`${sourcePath(command.name)}\``),
      ].join('\n'),
  },
  {
    dir: '.agents/skills',
    pathFor: (name) => `.agents/skills/${name}/SKILL.md`,
    render: (command) =>
      [
        '---',
        `name: ${command.name}`,
        `description: ${yamlString(
          `Only when the user explicitly invokes /${command.name} or $${command.name}. ${command.description}`
        )}`,
        '---',
        '',
        `<!-- ${GENERATED_MARKER} -->`,
        '',
        pointerBody(command.name, `\`${sourcePath(command.name)}\``),
      ].join('\n'),
  },
];

/** Extracts the `description:` value from a markdown file's YAML frontmatter. */
export function parseDescription(markdown: string): string | undefined {
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(markdown)?.[1];
  if (frontmatter === undefined) return undefined;
  const value = /^description:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim();
  if (!value) return undefined;
  return value.startsWith('"') ? (JSON.parse(value) as string) : value;
}

function readCommands(errors: string[]): AgentCommand[] {
  const names = readdirSync(join(ROOT, SOURCE_DIR))
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.slice(0, -'.md'.length))
    .sort();
  const commands: AgentCommand[] = [];
  for (const name of names) {
    const description = parseDescription(
      readFileSync(join(ROOT, sourcePath(name)), 'utf8')
    );
    if (description) commands.push({ name, description });
    else
      errors.push(`${sourcePath(name)}: missing \`description:\` frontmatter`);
  }
  return commands;
}

export function renderStubs(commands: AgentCommand[]): GeneratedFile[] {
  return STUB_TARGETS.flatMap((target) =>
    commands.map((command) => ({
      path: target.pathFor(command.name),
      content: target.render(command),
    }))
  );
}

function listFiles(dir: string): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { recursive: true, encoding: 'utf8' })
    .map((file) => `${dir}/${slashPath(file)}`)
    .filter((file) => lstatSync(join(ROOT, file)).isFile());
}

function staleStubs(expected: Set<string>): string[] {
  return STUB_TARGETS.flatMap((target) => listFiles(target.dir)).filter(
    (file) =>
      !expected.has(file) &&
      readFileSync(join(ROOT, file), 'utf8').includes(GENERATED_MARKER)
  );
}

function symlinkTarget(linkPath: string): string {
  const depth = linkPath.split('/').length - 1;
  return `${'../'.repeat(depth)}${SOURCE_DIR}`;
}

function isSymlinkTo(linkPath: string, target: string): boolean {
  const abs = join(ROOT, linkPath);
  try {
    return (
      lstatSync(abs).isSymbolicLink() && slashPath(readlinkSync(abs)) === target
    );
  } catch {
    return false;
  }
}

function syncSymlinks(verify: boolean, drift: string[]): void {
  for (const linkPath of SYMLINK_DIRS) {
    const target = symlinkTarget(linkPath);
    if (isSymlinkTo(linkPath, target)) continue;
    drift.push(`${linkPath} must be a symlink to ${target}`);
    if (verify) continue;
    const abs = join(ROOT, linkPath);
    if (isSymlink(abs)) removeTree(abs);
    else if (existsSync(abs)) {
      drift.push(
        `${linkPath} is a real directory; move its files into ${SOURCE_DIR} and delete it`
      );
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    symlinkSync(target, abs, 'dir');
  }
}

function isSymlink(abs: string): boolean {
  try {
    return lstatSync(abs).isSymbolicLink();
  } catch {
    return false;
  }
}

function syncStubs(
  files: GeneratedFile[],
  verify: boolean,
  drift: string[]
): void {
  for (const file of files) {
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
  for (const stale of staleStubs(new Set(files.map((file) => file.path)))) {
    drift.push(`${stale} has no source in ${SOURCE_DIR}`);
    if (!verify) rmSync(join(ROOT, stale));
  }
}

export function syncAgentCommands(verify: boolean): {
  errors: string[];
  drift: string[];
} {
  const errors: string[] = [];
  const drift: string[] = [];
  const commands = readCommands(errors);
  drift.push(...syncAgentInstructions(verify));
  syncSymlinks(verify, drift);
  syncStubs(renderStubs(commands), verify, drift);
  return { errors, drift };
}

if (import.meta.main) {
  const verify = process.argv.includes('--check');
  const { errors, drift } = syncAgentCommands(verify);
  drift.push(...syncAgentMcp(verify));
  const blocked = drift.some((line) => line.includes('is a real directory'));
  if (errors.length > 0 || blocked || (verify && drift.length > 0)) {
    console.error('agent-commands gate failed:');
    for (const line of [...errors, ...drift]) console.error(`  ${line}`);
    if (verify && !blocked) console.error(`  fix: ${SYNC_COMMAND}`);
    process.exit(1);
  }
  for (const line of drift) console.log(`synced: ${line}`);
  console.log(
    `ok: agent commands in sync with ${SOURCE_DIR}, MCP servers in every harness`
  );
}
