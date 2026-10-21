import { restartApp } from '@libs/harness-ts/actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import {
  backToTabs,
  openSettings,
  openTab,
} from '@libs/harness-ts/shell-actions';
import { chooseTheme } from '@libs/runtime-harness-ts/app-settings';
import {
  answerContinuityChoice,
  readContinuityChoice,
  setContinuityConnection,
} from '@libs/runtime-harness-ts/connection-continuity-model';
import {
  prepareSharedChoice,
  sharedChoiceLink,
} from '@libs/runtime-harness-ts/shared-choice-continuity';
import { askToJoinAfterAdmission } from '@libs/spaces-harness-ts/space-join-interruption';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import admittedOffline from './fixtures/connection-admitted-choice-offline.itf.json';
import refusedAfterReopen from './fixtures/connection-refusal-races-space-ending.itf.json';
import returnedOrigin from './fixtures/connection-return-does-not-refresh.itf.json';
import returnedProbe from './fixtures/stale-sync-error-keeps-missing-notice.itf.json';

const ACTOR = 'alice';

bindQuintModel<QuintHarnessWorld>({
  model: 'connection-continuity',
  traces: 16,
  maxSteps: 12,
  timeoutMs: 180_000,
  regressions: [
    {
      // regression: connection-refusal-races-space-ending
      id: 'connection-refusal-races-space-ending',
      title: 'An ended space refuses a held join after repeated reopening',
      seed: '0x67932',
      itf: refusedAfterReopen,
    },
    {
      // regression: stale-sync-error-keeps-missing-notice
      id: 'stale-sync-error-keeps-missing-notice',
      title:
        'A stale sync error does not outlive the restored server connection',
      seed: '0x67932',
      itf: returnedProbe,
    },
    {
      // regression: connection-admitted-choice-offline
      id: 'connection-admitted-choice-offline',
      title: 'An admitted choice can count after the device closes offline',
      seed: '0x67932',
      itf: admittedOffline,
    },
    {
      // regression: connection-return-does-not-refresh
      id: 'connection-return-does-not-refresh',
      title: 'Shared return refreshes the reopened local app without moving it',
      seed: '0x67932',
      itf: returnedOrigin,
    },
  ],
  actions: {
    init: async (w) => {
      await w.s.apply(chooseTheme, ACTOR, 'dark');
      await w.s.apply(backToTabs, ACTOR);
      await w.s.apply(prepareSharedChoice, ACTOR);
      const link = await w.s.read(sharedChoiceLink, ACTOR);
      w.memo.set('continuity-link', link);
      await w.s.apply(askToJoinAfterAdmission, ACTOR, link);
    },
    openTab: (w, picks) =>
      w.s.apply(
        openTab,
        ACTOR,
        picks['tab'] === 'profile' ? Handles.tabProfile : Handles.tabSpaces
      ),
    openSettings: (w) => w.s.apply(openSettings, ACTOR),
    putAsideChoice: (w) => w.s.apply(backToTabs, ACTOR),
    reopen: (w) => w.s.apply(restartApp, ACTOR),
    cutOff: (w) => w.s.apply(setContinuityConnection, ACTOR, 'device', false),
    reconnect: (w) => w.s.apply(setContinuityConnection, ACTOR, 'device', true),
    _sharedChoiceStops: (w) =>
      w.s.apply(setContinuityConnection, ACTOR, 'shared', false),
    _sharedChoiceReturns: (w) =>
      w.s.apply(setContinuityConnection, ACTOR, 'shared', true),
    _choiceAccepted: (w) =>
      w.s.apply(
        answerContinuityChoice,
        ACTOR,
        'accepted',
        String(w.memo.get('continuity-link'))
      ),
    _choiceRefused: (w) =>
      w.s.apply(
        answerContinuityChoice,
        ACTOR,
        'refused',
        String(w.memo.get('continuity-link'))
      ),
    _choiceAcceptedWithoutHearing: (w) =>
      w.s.apply(
        answerContinuityChoice,
        ACTOR,
        'unheard',
        String(w.memo.get('continuity-link'))
      ),
    _choiceOutcomeKnown: (w) =>
      w.s.apply(
        answerContinuityChoice,
        ACTOR,
        'accepted',
        String(w.memo.get('continuity-link'))
      ),
  },
  observe: (w) =>
    w.quiet.read(
      readContinuityChoice,
      ACTOR,
      String(w.memo.get('continuity-link'))
    ),
});
