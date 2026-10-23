import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { ReleaseEvidence } from '@pkgs/conformance-shared-ts/release-check';
import { checkRelease } from '@pkgs/conformance-shared-ts/release-check';
import { tools } from './developer-tools-state';
export const provideReleaseEvidence = scenarioAction({
  name: 'provideReleaseEvidence',
  act: (s, state: string) => {
    const evidence: ReleaseEvidence[] =
      state === 'missing' || state === 'not run'
        ? []
        : [
            {
              obligation: 'account privacy',
              edition:
                state === 'earlier' || state === 'stale'
                  ? 'previous'
                  : 'current',
              status:
                state === 'passing' || state === 'earlier' || state === 'manual'
                  ? 'pass'
                  : state === 'failed'
                    ? 'fail'
                    : state,
              automated: state !== 'manual',
            },
          ];
    tools(s).releaseEvidence = evidence;
  },
});
export const runReleaseCheck = scenarioAction({
  name: 'runReleaseCheck',
  act: (s) => {
    const state = tools(s);
    state.releaseVerdict = checkRelease({
      edition: 'current',
      required: ['account privacy'],
      evidence: state.releaseEvidence,
    });
  },
});
export const releaseResult = (s: ProductHarness) => tools(s).releaseVerdict;

export const currentReleaseEvidence = (s: ProductHarness) =>
  tools(s).releaseEvidence.filter(
    (record) => record.edition === 'current' && record.automated
  );
