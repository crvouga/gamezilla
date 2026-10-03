import {
  closePuzzleFeedSettings,
  openPuzzleFeedSettings,
  openPuzzleFromSpace,
  returnToOwnSpace,
} from '@libs/chess/harness/chess-actions';
import { discardFeedSettings } from '@libs/chess/harness/chess-puzzle-feed-ui';
import { readPuzzleControlAvailability } from '@libs/chess/harness/puzzle-control-reads';
import {
  previewPuzzleFeedChoice,
  readSavedFeedChoice,
} from '@libs/chess/harness/puzzle-feed-model';
import {
  partition,
  restartApp,
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness';
import type { QuintHarnessWorld } from '@libs/harness/quint/world';
import { restoreActorConnection } from '@libs/harness/system/actions';
import { bringToFront } from '@libs/harness/system/observations';
import { focusActor } from '@libs/harness/system/shell-actions';
import { createSpace } from '@libs/spaces/harness/space-actions';
import { bindQuintModel } from '@pkgs/quint/registry';
import autoAdvanceTrace from './fixtures/puzzle-feed-auto-advance-save.itf.json';

bindQuintModel<QuintHarnessWorld>({
  model: 'puzzle-feed',
  traces: 24,
  maxSteps: 32,
  timeoutMs: 180_000,
  regressions: [
    // regression: puzzle-feed-draft-auto-advance
    {
      id: 'puzzle-feed-auto-advance-save',
      title: 'A saved auto-advance preference survives reopening',
      seed: '0x67932',
      itf: autoAdvanceTrace,
    },
  ],
  actions: {
    init: async (w) => {
      await w.s.apply(signInWithGoogle, 'alice');
      await w.s.apply(signInWithGoogleAsAccount, 'charlie', 'alice');
      await w.s.apply(createSpace, 'alice');
      await w.s.apply(openPuzzleFromSpace, 'alice');
      await w.s.apply(returnToOwnSpace, 'charlie');
    },
    startEditingFeed: async (w) => {
      await w.s.apply(focusActor, 'alice');
      await w.s.apply(openPuzzleFeedSettings, 'alice');
    },
    previewFeedChoice: (w, picks) =>
      w.s.apply(previewPuzzleFeedChoice, 'alice', String(picks['choice'])),
    saveFeedChoices: (w) => w.s.apply(closePuzzleFeedSettings, 'alice'),
    discardFeedChoices: (w) => w.s.apply(discardFeedSettings, 'alice'),
    reopenApp: async (w) => {
      await w.s.apply(restartApp, 'alice');
      await w.s.apply(returnToOwnSpace, 'alice');
    },
    _loseConnection: (w, picks) =>
      w.s.apply(partition, String(picks['device'])),
    connectionReturns: (w, picks) =>
      w.s.apply(restoreActorConnection, String(picks['device'])),
    _wait: (w) => w.s.advanceTime(1_000),
  },
  observe: async (w) => {
    const feedChoice = new Map<string, string>();
    for (const actor of ['alice', 'charlie'])
      feedChoice.set(actor, await w.quiet.read(readSavedFeedChoice, actor));
    await w.quiet.read(bringToFront, 'alice');
    return {
      feedChoice,
      editing: (await w.quiet.read(readPuzzleControlAvailability, 'alice'))
        .editingFeed,
    };
  },
});
