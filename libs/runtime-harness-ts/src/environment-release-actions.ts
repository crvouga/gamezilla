import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  checkReplacement,
  preparationOutcome,
  type ReleasePolicy,
  releaseAfterCheck,
  startedReleaseAfterCancel,
} from '@libs/runtime-server-ts/environment-release';

function remember(
  s: ProductHarness,
  releaseState: string,
  checkState: string,
  openState: string
): void {
  s.probes.environmentRelease = { releaseState, checkState, openState };
}

export const prepareDespiteFailure = scenarioAction({
  name: 'prepareDespiteFailure',
  act: (s, policy: ReleasePolicy) => {
    preparationOutcome(policy);
    remember(s, 'none', 'idle', 'told-and-open');
  },
});

export const releaseAfterPass = scenarioAction({
  name: 'releaseAfterPass',
  act: (s, policy: ReleasePolicy) => {
    remember(s, releaseAfterCheck(policy, 'passed'), 'passed', 'closed');
  },
});

export const releaseAfterFailure = scenarioAction({
  name: 'releaseAfterFailure',
  act: (s, policy: ReleasePolicy) => {
    remember(s, releaseAfterCheck(policy, 'failed'), 'failed', 'closed');
  },
});

export const replaceRunningCheck = scenarioAction({
  name: 'replaceRunningCheck',
  act: (s, policy: ReleasePolicy) => {
    remember(s, 'none', checkReplacement(policy, 'proposal'), 'closed');
  },
});

export const keepReleaseCheck = scenarioAction({
  name: 'keepReleaseCheck',
  act: (s, policy: ReleasePolicy) => {
    remember(s, 'none', checkReplacement(policy, 'release'), 'closed');
  },
});

export const keepUnfinishedRelease = scenarioAction({
  name: 'keepUnfinishedRelease',
  act: (s, policy: ReleasePolicy) => {
    remember(s, startedReleaseAfterCancel(policy), 'kept', 'closed');
  },
});

export const stopStartedRelease = scenarioAction({
  name: 'stopStartedRelease',
  act: (s, policy: ReleasePolicy) => {
    remember(s, startedReleaseAfterCancel(policy), 'idle', 'closed');
  },
});

export const noteReleaseFact = scenarioAction({
  name: 'noteReleaseFact',
  act: (s, fact: 'passed' | 'failed' | 'unfinished' | 'release-check') => {
    s.probes.releaseFact = fact;
  },
});

export const releaseFact = (s: ProductHarness) => {
  const fact = s.probes.releaseFact;
  if (fact === undefined) throw new Error('No release fact');
  return fact;
};

export const environmentView = (s: ProductHarness) =>
  s.probes.environmentRelease ?? {
    releaseState: 'none',
    checkState: 'idle',
    openState: 'closed',
  };
