import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  renderCodexToml,
  renderJson,
  serenaArgs,
  syncAgentMcp,
} from './sync-agent-mcp';

const ROOT = join(import.meta.dirname, '../../..');

const target = {
  path: '.mcp.json',
  container: 'mcpServers',
  launch: { context: 'claude-code', project: 'cwd' as const },
  entry: (args: string[]) => ({ command: 'mise', args }),
};

describe('serenaArgs', () => {
  test('agents that start in the project find it from the working directory', () => {
    expect(serenaArgs({ context: 'codex', project: 'cwd' })).toEqual([
      'exec',
      '--',
      'serena',
      'start-mcp-server',
      '--context',
      'codex',
      '--project-from-cwd',
      '--open-web-dashboard',
      'false',
    ]);
  });

  test('IDEs name the workspace, and mise resolves the pin from it', () => {
    const args = serenaArgs({ context: 'ide', project: 'workspace-folder' });
    expect(args.slice(0, 3)).toEqual(['-C', '${workspaceFolder}', 'exec']);
    expect(args).toContain('--project');
    expect(args).not.toContain('--project-from-cwd');
  });
});

describe('renderJson', () => {
  test('keeps every other server and key in the file', () => {
    const existing = JSON.stringify({
      other: 1,
      mcpServers: { Sentry: { url: 'https://example.test/mcp' } },
    });
    const next = JSON.parse(renderJson(existing, target)) as {
      other: number;
      mcpServers: {
        Sentry: { url: string };
        serena: { command: string };
      };
    };
    expect(next.other).toBe(1);
    expect(next.mcpServers.Sentry).toEqual({ url: 'https://example.test/mcp' });
    expect(next.mcpServers.serena.command).toBe('mise');
  });

  test('is a fixed point', () => {
    const once = renderJson(undefined, target);
    expect(renderJson(once, target)).toBe(once);
  });
});

describe('renderCodexToml', () => {
  test('replaces only its own block', () => {
    const once = renderCodexToml('model = "x"\n');
    expect(once.startsWith('model = "x"\n\n# BEGIN serena')).toBe(true);
    expect(renderCodexToml(once)).toBe(once);
    const edited = `${once}[features]\nmulti_agent = true\n`;
    expect(renderCodexToml(edited)).toBe(edited);
  });
});

test('checked-in agent MCP files match the generator', () => {
  expect(syncAgentMcp(true)).toEqual([]);
});

test('Serena is a pinned mise tool, never a hand-installed one', () => {
  const { tools } = Bun.TOML.parse(
    readFileSync(join(ROOT, 'mise.toml'), 'utf8')
  ) as { tools: Record<string, { version?: string }> };
  expect(tools['pipx:serena-agent']?.version).toMatch(/^\d+\.\d+\.\d+$/);
});
