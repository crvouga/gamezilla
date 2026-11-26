/**
 * A browser device runs the build the harness put it on. The browser sends
 * its own requests (to the harness balancer in `seeded`/`real`, to the
 * separately booted stack in `stack`), so the build lives in the page: each
 * document it opens is put on the device's build, and a change reaches the
 * open document at once.
 */

import { type HarnessAppBuilds, pageAppBuildScript } from './app-build';

type PageView = {
  evaluate(script: string): Promise<unknown>;
};

export type WebviewAppBuild = {
  /** Put the document the device just opened on its build. */
  readonly apply: () => Promise<void>;
  readonly stop: () => void;
};

export function webviewAppBuild(
  view: PageView,
  builds: HarnessAppBuilds,
  deviceId: string
): WebviewAppBuild {
  const apply = async () => {
    const build = builds.of(deviceId);
    if (build === 'outdated') await view.evaluate(pageAppBuildScript(build));
  };
  const stop = builds.watch(deviceId, async (build) => {
    await view.evaluate(pageAppBuildScript(build));
  });
  return { apply, stop };
}
