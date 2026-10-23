/**
 * `specs/runtime/environment-release.qnt` against the shipped preparation
 * and release definitions. Each action asks those definitions what the team
 * would see.
 */

import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import {
  environmentView,
  keepReleaseCheck,
  keepUnfinishedRelease,
  prepareDespiteFailure,
  releaseAfterFailure,
  releaseAfterPass,
  replaceRunningCheck,
  stopStartedRelease,
} from '@libs/runtime-harness-ts/environment-release-actions';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import { readReleasePolicy } from '../environment-release-policy';

bindQuintModel<QuintHarnessWorld>({
  model: 'environment-release',
  traces: 32,
  maxSteps: 6,
  timeoutMs: 120_000,
  actions: {
    init: async () => undefined,
    prepareDespiteFailure: async (w) => {
      await w.s.apply(prepareDespiteFailure, await readReleasePolicy());
    },
    releaseAfterPass: async (w) => {
      await w.s.apply(releaseAfterPass, await readReleasePolicy());
    },
    releaseAfterFailure: async (w) => {
      await w.s.apply(releaseAfterFailure, await readReleasePolicy());
    },
    replaceRunningCheck: async (w) => {
      await w.s.apply(replaceRunningCheck, await readReleasePolicy());
    },
    keepReleaseCheck: async (w) => {
      await w.s.apply(keepReleaseCheck, await readReleasePolicy());
    },
    keepUnfinishedRelease: async (w) => {
      await w.s.apply(keepUnfinishedRelease, await readReleasePolicy());
    },
    stopStartedRelease: async (w) => {
      await w.s.apply(stopStartedRelease, await readReleasePolicy());
    },
  },
  observe: (w) => w.quiet.read(environmentView),
});
