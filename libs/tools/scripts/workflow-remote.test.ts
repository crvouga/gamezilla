import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { WORKFLOW_DISPATCH } from './workflow-remote';

const SCROLL_DOWN = '\u001b[B';

const WORKFLOWS = join(import.meta.dirname, '../../../.depot/workflows');

describe('WORKFLOW_DISPATCH', () => {
  test('check and health follow the checkout; deploy ships main', () => {
    expect(WORKFLOW_DISPATCH.check).toEqual({
      workflow: 'check.yml',
      sync: 'branch',
      refuseOnMain: true,
      printsReport: true,
    });
    expect(WORKFLOW_DISPATCH.health).toEqual({
      workflow: 'health.yml',
      sync: 'branch',
      refuseOnMain: false,
      printsReport: false,
    });
    expect(WORKFLOW_DISPATCH.deploy).toEqual({
      workflow: 'deploy.yml',
      sync: 'trunk',
      refuseOnMain: false,
      printsReport: false,
    });
  });

  // regression: watch-scroll-echo
  test('scroll keys are not echoed while the watch holds the tty', async () => {
    const chunks: Uint8Array[] = [];
    const terminal = new Bun.Terminal({
      cols: 80,
      rows: 24,
      data(_term, data) {
        chunks.push(Uint8Array.from(data));
      },
    });
    const proc = Bun.spawn(
      ['bun', join(import.meta.dirname, 'workflow-remote-tty-fixture.ts')],
      { terminal }
    );
    const shown = (): string => Buffer.concat(chunks).toString('utf8');
    try {
      let text = '';
      for (
        let attempt = 0;
        attempt < 200 && !text.includes('READY');
        attempt += 1
      ) {
        await Bun.sleep(20);
        text = shown();
      }
      expect(text).toContain('READY');
      terminal.write(SCROLL_DOWN + SCROLL_DOWN + SCROLL_DOWN);
      expect(await proc.exited).toBe(0);
      const out = shown();
      expect(out).toContain('DONE');
      expect(out).not.toContain('^[[B');
      expect(out).not.toContain(SCROLL_DOWN);
    } finally {
      proc.kill();
      terminal.close();
    }
  });

  test('workflow jobs call the local runners', () => {
    const health = readFileSync(join(WORKFLOWS, 'health.yml'), 'utf8');
    const deploy = readFileSync(join(WORKFLOWS, 'deploy.yml'), 'utf8');
    expect(health).toContain('run: bun run health:local');
    expect(health).not.toContain('run: bun run health\n');
    expect(deploy).toContain('run: bun run deploy:local');
    expect(deploy).not.toContain('run: bun run deploy\n');
    expect(deploy).toContain('refs/heads/main');
  });
});
