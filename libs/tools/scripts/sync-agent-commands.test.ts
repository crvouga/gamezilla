import { describe, expect, test } from 'bun:test';

import {
  GENERATED_MARKER,
  parseDescription,
  renderStubs,
  syncAgentCommands,
} from './sync-agent-commands';

describe('parseDescription', () => {
  test('reads plain and quoted frontmatter values', () => {
    expect(parseDescription('---\ndescription: Ship it\n---\n# x')).toBe(
      'Ship it'
    );
    expect(parseDescription('---\ndescription: "a: b"\n---\n')).toBe('a: b');
  });

  test('is undefined without frontmatter', () => {
    expect(parseDescription('# /optimize\n')).toBeUndefined();
  });
});

describe('renderStubs', () => {
  const files = renderStubs([{ name: 'pr-merge', description: 'Go "green"' }]);

  test('emits one stub per harness, each pointing at the source file', () => {
    expect(files.map((file) => file.path)).toEqual([
      '.gemini/commands/pr-merge.toml',
      '.github/prompts/pr-merge.prompt.md',
      '.windsurf/workflows/pr-merge.md',
      '.agents/skills/pr-merge/SKILL.md',
    ]);
    for (const file of files) {
      expect(file.content).toContain('.agents/commands/pr-merge.md');
      expect(file.content).toContain(GENERATED_MARKER);
    }
  });

  test('escapes descriptions for TOML and YAML', () => {
    const [gemini, copilot] = files;
    expect(gemini?.content).toContain('description = "Go \\"green\\""');
    expect(copilot?.content).toContain('description: "Go \\"green\\""');
  });
});

test('checked-in harness command files match .agents/commands', () => {
  expect(syncAgentCommands(true)).toEqual({ errors: [], drift: [] });
});
