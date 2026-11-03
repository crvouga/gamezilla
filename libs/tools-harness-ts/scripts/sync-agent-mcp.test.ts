import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRODUCT } from '@libs/product-identity-shared-ts/product-identity';

import {
  renderCodexToml,
  renderJson,
  SENTRY_MCP,
  STORYBOOK_MCP_URL,
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

  test('generated servers replace a stale entry and keep its place', () => {
    const existing = JSON.stringify({
      mcpServers: { Sentry: { url: 'https://example.test/mcp' }, other: {} },
    });
    const next = renderJson(existing, {
      ...target,
      servers: { Sentry: SENTRY_MCP },
    });
    const servers = (JSON.parse(next) as { mcpServers: object }).mcpServers;
    expect(Object.keys(servers)).toEqual([
      'Sentry',
      'other',
      'storybook',
      'serena',
    ]);
    expect(servers).toMatchObject({ Sentry: SENTRY_MCP });
  });
});

describe('renderCodexToml', () => {
  test('replaces only its own block', () => {
    const once = renderCodexToml('model = "x"\n');
    expect(once.startsWith('model = "x"\n\n# BEGIN serena')).toBe(true);
    expect(renderCodexToml(once)).toBe(once);
    const edited = `${once}[features]\nmulti_agent = true\n`;
    expect(renderCodexToml(edited)).toBe(edited);
    const separated = once.replace(
      '# END serena',
      '# END serena\n\n[features]\nx = true'
    );
    expect(renderCodexToml(separated)).toBe(separated);
  });
});

test('checked-in agent MCP files match the generator', () => {
  expect(syncAgentMcp(true)).toEqual([]);
});

test('.cursor/mcp.json names the Sentry organization of the product identity', () => {
  const cursor = JSON.parse(
    readFileSync(join(ROOT, '.cursor/mcp.json'), 'utf8')
  ) as { mcpServers: Record<string, unknown> };
  expect(cursor.mcpServers['Sentry']).toEqual({
    url: `https://mcp.sentry.dev/mcp/${PRODUCT.external.sentryOrganization}`,
  });
});

test('Serena is a pinned mise tool, never a hand-installed one', () => {
  const { tools } = Bun.TOML.parse(
    readFileSync(join(ROOT, 'mise.toml'), 'utf8')
  ) as { tools: Record<string, { version?: string }> };
  expect(tools['pipx:serena-agent']?.version).toMatch(/^\d+\.\d+\.\d+$/);
});

test('all generated clients receive Storybook with their native HTTP transport', () => {
  const read = (path: string) =>
    JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
  expect(read('.mcp.json')).toMatchObject({
    mcpServers: { storybook: { type: 'http', url: STORYBOOK_MCP_URL } },
  });
  expect(read('.gemini/settings.json')).toMatchObject({
    mcpServers: { storybook: { httpUrl: STORYBOOK_MCP_URL } },
  });
  expect(read('opencode.json')).toMatchObject({
    mcp: {
      storybook: { type: 'remote', url: STORYBOOK_MCP_URL, enabled: true },
    },
  });
  const codex = Bun.TOML.parse(
    readFileSync(join(ROOT, '.codex/config.toml'), 'utf8')
  ) as { mcp_servers: { storybook: { url: string } } };
  expect(codex.mcp_servers.storybook.url).toBe(STORYBOOK_MCP_URL);
});
