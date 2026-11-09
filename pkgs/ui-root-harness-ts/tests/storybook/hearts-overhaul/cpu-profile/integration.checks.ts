// @io-wall-ok — isolated browser profile; canonical runner owns cleanup.
import { test } from '@playwright/test';
import { attachHeartsText } from '../attachments';
import { HEARTS_TIMING_CONDITIONS, openHearts } from '../evidence';
import { exerciseHeartsTrick } from '../isolated-performance/inputs';

type ProfileNode = {
  readonly id: number;
  readonly callFrame: {
    readonly functionName: string;
    readonly url: string;
    readonly lineNumber: number;
  };
};
type CpuProfile = {
  readonly nodes: readonly ProfileNode[];
  readonly samples: readonly number[];
  readonly timeDeltas: readonly number[];
};

/** Self time per function, heaviest first: where the trick's CPU goes. */
function heaviest(profile: CpuProfile, limit: number) {
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const self = new Map<string, number>();
  profile.samples.forEach((id, index) => {
    const frame = byId.get(id)?.callFrame;
    if (frame === undefined) return;
    const file = frame.url.split('/').at(-1)?.split('?')[0] ?? '';
    const key = `${frame.functionName || '(anonymous)'} ${file}:${frame.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (profile.timeDeltas[index] ?? 0));
  });
  return [...self.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([fn, micros]) => ({ fn, ms: Math.round(micros / 10) / 100 }));
}

test.use({
  trace: 'off',
  video: 'off',
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});

// Profiling slows the page, so it never shares a run with the timed trials.
test('storybook integration: Hearts trick CPU profile at 4x for diagnosis', async ({
  page,
}, info) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await openHearts(
    page,
    'screens-games-hearts-interaction--pass-and-play',
    'light'
  );
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await exerciseHeartsTrick(page, true);
  const { profile } = (await cdp.send('Profiler.stop')) as {
    profile: CpuProfile;
  };
  const total = profile.timeDeltas.reduce((sum, delta) => sum + delta, 0);
  await attachHeartsText(
    info,
    'trick-cpu-profile.json',
    JSON.stringify(
      {
        purpose:
          'Diagnosis only: where CPU goes during pass and plays. Profiling overhead makes these times larger than the timed trials.',
        conditions: HEARTS_TIMING_CONDITIONS,
        cpuThrottle: 4,
        viewport: page.viewportSize(),
        totalMs: Math.round(total / 1000),
        heaviestSelfTime: heaviest(profile, 60),
      },
      null,
      2
    )
  );
});
