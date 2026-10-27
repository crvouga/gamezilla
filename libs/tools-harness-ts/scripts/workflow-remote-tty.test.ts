import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

// Bun.Terminal is a POSIX pseudo-terminal: this runs in `test:posix`.
const SCROLL_DOWN = '\u001b[B';

describe('WORKFLOW_DISPATCH', () => {
  // regression: watch-scroll-echo
  // regression: verify-tty-exit-before-output
  test('scroll keys are not echoed while the watch holds the tty', async () => {
    const chunks: Uint8Array[] = [];
    let signalReady!: () => void;
    let signalDone!: () => void;
    const ready = new Promise<void>((resolve) => {
      signalReady = resolve;
    });
    const done = new Promise<void>((resolve) => {
      signalDone = resolve;
    });
    const terminal = new Bun.Terminal({
      cols: 80,
      rows: 24,
      data(_term, data) {
        chunks.push(Uint8Array.from(data));
        const text = Buffer.concat(chunks).toString('utf8');
        if (text.includes('READY')) signalReady();
        if (text.includes('DONE')) signalDone();
      },
    });
    const proc = Bun.spawn(
      ['bun', join(import.meta.dirname, 'workflow-remote-tty-fixture.ts')],
      { terminal }
    );
    const shown = (): string => Buffer.concat(chunks).toString('utf8');
    try {
      await ready;
      expect(shown()).toContain('READY');
      terminal.write(SCROLL_DOWN + SCROLL_DOWN + SCROLL_DOWN);
      await done;
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
});
