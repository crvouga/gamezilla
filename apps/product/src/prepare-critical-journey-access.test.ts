// regression: signed-in-health-before-tab-shell
import { describe, expect, test } from 'bun:test';
import { prepareCriticalJourneyAccess } from './prepare-critical-journey-access';

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
      signIn: recordStep(steps, 'sign-in'),
    });
    expect(steps).toEqual(['launch', 'tab-shell', 'sign-in']);
  });

  // regression: journey-guest-starts-before-tab-shell
  test('settles the initial tab route before an anonymous journey', async () => {
    const steps: string[] = [];
    await prepareCriticalJourneyAccess({
      access: 'anonymous',
      launch: recordStep(steps, 'launch'),
      waitForTabShell: recordStep(steps, 'tab-shell'),
      signIn: recordStep(steps, 'sign-in'),
    });
    expect(steps).toEqual(['launch', 'tab-shell']);
  });
});
