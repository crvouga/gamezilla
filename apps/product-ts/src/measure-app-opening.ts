// @io-wall-ok — navigates the real browser, delivers trusted input, and reads its frame samples.
import { JOURNEY_WAIT_MS } from '@libs/runtime-harness-ts/journey-gestures';
import type { OpeningResult } from '@libs/runtime-harness-ts/journey-types';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { monotonicClock } from '@pkgs/clock-shared-ts/wall';
import { processLifecycle } from '@pkgs/os-server-ts/process-lifecycle';
import type { Device } from './live-browser';
import { openDevice } from './live-browser';
import type { LiveDevices } from './live-journey-devices';
import { type OpeningControls, openingObserverScript } from './opening-frames';
import { recordOpening } from './opening-review-video';

const controls: OpeningControls = {
  settings: Handles.globalMenuSettings,
  menu: Handles.statusCurrentUser,
  sound: Handles.settingsSound,
  spinner:
    '[data-testid="boot-loading"], .activity-indicator, [role="progressbar"]:not([aria-valuenow]), [data-activity-indicator]',
};

type Observation = Omit<Extract<OpeningResult, { kind: 'browser' }>, 'kind'>;
type Target = { id: string; x: number; y: number };
type Frame = {
  readonly result: Observation;
  readonly target: Target | null;
};

async function tap(view: Device['view'], { x, y }: Target): Promise<void> {
  for (const type of ['mousePressed', 'mouseReleased'])
    await view.cdp('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
}

async function readFrame(view: Device['view']): Promise<Frame | undefined> {
  const { result, exceptionDetails } = await view.cdp<{
    result?: { value?: Frame };
    exceptionDetails?: unknown;
  }>('Runtime.evaluate', {
    expression: 'globalThis.__observedAppOpening?.()',
    returnByValue: true,
  });
  if (exceptionDetails)
    throw new Error('Chrome could not read the opening frame');
  return result?.value;
}

function scriptLatency(view: Device['view'], delay: boolean): Promise<unknown> {
  return view.cdp('Network.emulateNetworkConditionsByRule', {
    offline: false,
    matchedNetworkConditions: delay
      ? [
          {
            urlPattern: '*://*/*.js',
            latency: 1200,
            downloadThroughput: -1,
            uploadThroughput: -1,
          },
        ]
      : [],
  });
}

/** Fresh Chrome on the first opening; a new document in the existing profile on return. */
export async function measureAppOpening(
  target: Parameters<typeof openDevice>[0],
  devices: LiveDevices
): Promise<OpeningResult> {
  const profile = devices.host === null ? 'fresh' : 'returning';
  const device = (devices.host ??= await openDevice(target));
  devices.shown = device;
  return recordOpening(device, profile, () =>
    measure(device.view, target.webOrigin, profile)
  );
}

async function measure(
  view: Device['view'],
  url: string,
  profile: 'fresh' | 'returning'
): Promise<Extract<OpeningResult, { kind: 'browser' }>> {
  let slowScripts = profile === 'fresh';
  await view.cdp('Page.bringToFront', {});
  await view.cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: openingObserverScript(controls),
  });
  if (slowScripts) await scriptLatency(view, true);
  await view.cdp('Page.navigate', { url });
  const deadline = monotonicClock.now() + JOURNEY_WAIT_MS;
  const tapped = new Set<string>();
  let observation: Observation = {
    settingsAtMs: null,
    spinnerAtMs: null,
    spinnerFrames: 0,
    runtimeSettingsVisible: false,
  };
  while (monotonicClock.now() < deadline) {
    const frame = await readFrame(view);
    if (frame) {
      observation = frame.result;
      if (frame.target && !tapped.has(frame.target.id)) {
        tapped.add(frame.target.id);
        await tap(view, frame.target);
      }
      if (observation.runtimeSettingsVisible) break;
      if (slowScripts && observation.settingsAtMs !== null) {
        await scriptLatency(view, false);
        slowScripts = false;
      }
    }
    // After the click the document samples every frame without driver polling.
    await Bun.sleep(tapped.has(controls.settings) ? 80 : 8);
  }
  processLifecycle().writeOutput(
    `App opening measurement (${profile}): ${JSON.stringify(observation)}\n`
  );
  return { kind: 'browser', ...observation };
}
