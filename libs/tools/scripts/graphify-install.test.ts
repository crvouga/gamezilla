import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLAUDE_SKILL_LINK,
  claudeSkillTarget,
  graphifyInstallCommand,
  SKILL_DIR,
} from './graphify-install';

const ROOT = join(import.meta.dirname, '../../..');

test('the project skill is installed for the Codex-readable agents directory', () => {
  expect(graphifyInstallCommand('graphify')).toEqual([
    'graphify',
    'install',
    '--project',
    '--platform',
    'agents',
  ]);
});

test('Claude Code reaches the same skill through a relative symlink', () => {
  expect(CLAUDE_SKILL_LINK).toBe('.claude/skills/graphify');
  expect(claudeSkillTarget()).toBe('../../.agents/skills/graphify');
  expect(SKILL_DIR).toBe('.agents/skills/graphify');
});

test('graphify is a pinned mise tool, never a hand-installed one', () => {
  const { tools } = Bun.TOML.parse(
    readFileSync(join(ROOT, 'mise.toml'), 'utf8')
  ) as { tools: Record<string, unknown> };
  expect(tools['pipx:graphifyy']).toMatchObject({
    version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
    extras: 'terraform',
  });
  expect(tools['uv']).toMatch(/^\d+\.\d+\.\d+$/);
});

test('the generated skill and the graph are gitignored, not committed', () => {
  const ignore = readFileSync(join(ROOT, '.gitignore'), 'utf8').split('\n');
  expect(ignore).toContain('graphify-out/');
  expect(ignore).toContain(`/${SKILL_DIR}/`);
  expect(ignore).toContain(`/${CLAUDE_SKILL_LINK}`);
});
