// @io-wall-ok — hosted CPU profile of real-time play, printed to the job log.
import { test } from '@playwright/test';
import { openPong } from '../pong-overhaul/evidence';
import { logSummary } from '../pong-overhaul/log-evidence';

type ProfileNode = {
  id: number;
  callFrame: {
    functionName: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  children?: number[];
};

// Where a live rally's main-thread time goes on a 4x-throttled phone, by
// function and by source file, so per-frame cost is attributed from the run.
test('storybook integration: pong-overhaul live rally main-thread profile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPong(page, 'live-rally', 'light');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(50);
  await page.keyboard.up('ArrowDown');
  await cdp.send('Profiler.start');
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowUp', 'ArrowDown']) {
    await page.keyboard.down(key);
    await page.waitForTimeout(400);
    await page.keyboard.up(key);
  }
  const { profile } = (await cdp.send('Profiler.stop')) as unknown as {
    profile: { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] };
  };
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const self = new Map<number, number>();
  profile.samples.forEach((id, index) =>
    self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[index] ?? 0) / 1000)
  );
  const byFunction = new Map<string, number>();
  const byFile = new Map<string, number>();
  let total = 0;
  for (const node of profile.nodes) {
    const ms = self.get(node.id) ?? 0;
    total += ms;
    const frame = node.callFrame;
    const base = frame.url.split('/').pop()?.split('?')[0] ?? '';
    const file = base === '' ? frame.functionName : base;
    const fn = frame.functionName === '' ? '(anonymous)' : frame.functionName;
    const name = `${fn} ${file}:${frame.lineNumber}:${frame.columnNumber}`;
    byFunction.set(name, (byFunction.get(name) ?? 0) + ms);
    byFile.set(file, (byFile.get(file) ?? 0) + ms);
  }
  const top = (map: Map<string, number>, n: number) =>
    [...map]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, ms]) => [key, Math.round(ms * 10) / 10]);
  logSummary('PONG_PROFILE', {
    totalMs: Math.round(total),
    byFile: top(byFile, 15),
    byFunction: top(byFunction, 30),
  });
  await cdp.detach();
});
