import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

// regression: storybook-remote-localhost
test('remote Storybook renders assets and keeps live WebSockets on the accessed origin', async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error('Remote test requires a base URL');
  const connected: string[] = [];
  const failed: string[] = [];
  page.on('requestfailed', (request) => failed.push(request.url()));
  page.on('websocket', (socket) => {
    socket.on('framereceived', (event) => {
      if (String(event.payload).includes('"type":"connected"'))
        connected.push(socket.url());
    });
  });
  await page.goto(
    '/iframe.html?id=components-inputs-button--interactive&viewMode=story'
  );
  await expect(
    page.getByRole('button', { name: 'Save', exact: true })
  ).toBeVisible();
  await expect.poll(() => connected.length).toBeGreaterThan(0);
  for (const url of connected)
    expect(new URL(url).host).toBe(new URL(baseURL).host);
  expect(failed).toEqual([]);
});

test('unknown remote hostnames are rejected', async ({ request }) => {
  const response = await request.get('http://127.0.0.1:6010/index.json', {
    headers: { Host: 'unexpected.example.test' },
  });
  expect(response.status()).toBe(403);
});

test('readiness records the bound port and duplicate launch fails without replacing it', async () => {
  const path = join(import.meta.dirname, '../../.cache/storybook-dev.json');
  const read = () =>
    JSON.parse(readFileSync(path, 'utf8')) as {
      status: string;
      port: number;
      host: string;
      pid: number;
    };
  await expect.poll(() => read().status).toBe('ready');
  const before = read();
  expect(before.port).toBe(6010);
  expect(before.host).toBe('0.0.0.0');
  const child = spawnSync('bun', ['scripts/storybook-dev.ts', '--smoke-test'], {
    cwd: join(import.meta.dirname, '../..'),
    env: { ...process.env, STORYBOOK_PORT: '6010' },
    encoding: 'utf8',
    timeout: 10000,
  });
  expect(child.status).not.toBe(0);
  expect(child.stderr).toContain('already starting or running');
  expect(read()).toEqual(before);
});
