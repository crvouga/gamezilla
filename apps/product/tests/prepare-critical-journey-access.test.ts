// regression: signed-in-health-before-tab-shell
import { describe, expect, test } from 'bun:test';
import { prepareCriticalJourneyAccess } from '@apps/product/prepare-critical-journey-access';

function recordStep(steps: string[], step: string): () => Promise<void> {
  return () => {
    steps.push(step);
    return Promise.resolve();
  };
}

describe('prepareCriticalJourneyAccess', () => {
  test('settles the initial tab route before hosted sign-in', async () => {
    const steps: string[] = [];
    await prepareCriticalJourneyAccess({
      access: 'signed-in',
      launch: recordStep(steps, 'launch'),
      waitForTabShell: recordStep(steps, 'tab-shell'),
      waitForOfflineShell: recordStep(steps, 'offline-shell'),
      signIn: recordStep(steps, 'sign-in'),
    });
    expect(steps).toEqual(['launch', 'tab-shell', 'offline-shell', 'sign-in']);
  });

  // regression: journey-guest-starts-before-tab-shell
  test('settles the initial tab route before an anonymous journey', async () => {
    const steps: string[] = [];
    await prepareCriticalJourneyAccess({
      access: 'anonymous',
      launch: recordStep(steps, 'launch'),
      waitForTabShell: recordStep(steps, 'tab-shell'),
      waitForOfflineShell: recordStep(steps, 'offline-shell'),
      signIn: recordStep(steps, 'sign-in'),
    });
    expect(steps).toEqual(['launch', 'tab-shell', 'offline-shell']);
  });

  // regression: health-cold-install-network-contention
  test('a visible tab shell does not start sign-in while precaching is unfinished', async () => {
    const shell = Promise.withResolvers<void>();
    const steps: string[] = [];
    const opening = prepareCriticalJourneyAccess({
      access: 'signed-in',
      launch: recordStep(steps, 'launch'),
      waitForTabShell: recordStep(steps, 'tab-shell'),
      waitForOfflineShell: () => shell.promise,
      signIn: recordStep(steps, 'sign-in'),
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(steps).toEqual(['launch', 'tab-shell']);
    shell.resolve();
    await opening;
    expect(steps).toEqual(['launch', 'tab-shell', 'sign-in']);
  });
});
