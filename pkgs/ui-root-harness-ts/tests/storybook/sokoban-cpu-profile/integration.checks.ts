// @io-wall-ok — browser profiling is diagnostic, never product timing.
import { expect, test } from '@playwright/test';
import { counts, openSokoban } from '../sokoban-overhaul/evidence';
import { walking } from '../sokoban-overhaul/responsiveness';

type CpuProfile = {
  nodes: {
    id: number;
    callFrame: { functionName: string; url: string; lineNumber: number };
  }[];
  samples: number[];
  timeDeltas: number[];
};

function summarize(profile: CpuProfile) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const totals = new Map<string, number>();
  profile.samples.forEach((id, index) => {
    const frame = nodes.get(id)?.callFrame;
    if (!frame) return;
    const name = `${frame.functionName || '(anonymous)'} ${frame.url}:${frame.lineNumber + 1}`;
    totals.set(
      name,
      (totals.get(name) ?? 0) + (profile.timeDeltas[index] ?? 0)
    );
  });
  return [...totals]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([name, micros]) => ({ name, ms: micros / 1000 }));
}

// Profiling is a separate trial: its overhead must not alter timing verdicts.
test.use({ viewport: { width: 320, height: 740 }, trace: 'off', video: 'off' });

test('storybook integration: Sokoban maximum close view CPU profile at 4x for diagnosis', async ({
  page,
}, info) => {
  await openSokoban(page, 'puzzle--maximum-board', 'light');
  const board = page.getByTestId('sokoban-board');
  await page.getByRole('button', { name: 'Look closer' }).click();
  await expect(board.getByRole('img')).toHaveCount(36);
  for (let move = 0; move < 5; move++) await board.press('ArrowRight');
  await counts(page, 5, 5);
  await board.getByRole('img', { name: 'H2: floor, crate' }).click();
  await counts(page, 6, 6);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => {
      window.onkeydown = null;
    });
    await board.focus();
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
    const step = walking(6);
    for (let index = 0; index < 20; index++) {
      const moves = await step(page, index);
      await counts(page, moves, 6);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      );
    }
    const { profile } = (await cdp.send('Profiler.stop')) as {
      profile: CpuProfile;
    };
    await info.attach('sokoban-close-view.cpuprofile', {
      body: JSON.stringify(profile),
      contentType: 'application/json',
    });
    process.stdout.write(
      `SOKOBAN_CPU_PROFILE ${JSON.stringify({
        test: info.title,
        cpuSlowdown: 4,
        viewport: page.viewportSize(),
        workerIndex: info.workerIndex,
        heaviestSelfTime: summarize(profile),
        limits:
          'Separate diagnostic trial without video/trace; profiling adds overhead. These times are not a responsiveness verdict.',
      })}\n`
    );
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
  }
});
