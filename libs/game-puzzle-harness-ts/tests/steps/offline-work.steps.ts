import { expect } from 'bun:test';
import { changeContentAttempt } from '@libs/game-puzzle-harness-ts/attempt-actions';
import {
  arrangePersonalAttempt,
  copyAttemptToTablet,
} from '@libs/game-puzzle-harness-ts/attempt-fixtures';
import {
  currentAttemptView,
  keptAttemptStates,
} from '@libs/game-puzzle-harness-ts/attempt-observations';
import { openContentDraft } from '@libs/game-puzzle-harness-ts/content-actions';
import {
  arrangeNamedPack,
  saveNamedPackOrder,
} from '@libs/game-puzzle-harness-ts/named-pack-actions';
import {
  contentDeviceOffline,
  contentDeviceOnline,
  reopenContentDevice,
} from '@libs/game-puzzle-harness-ts/offline-actions';
import {
  arrangeOfflineDraft,
  arrangeOfflinePackCompletion,
  arrangeOfflinePlay,
  arrangeUnavailableOfflinePuzzle,
} from '@libs/game-puzzle-harness-ts/offline-fixtures';
import {
  completionRecordCount,
  contentDraftAvailable,
  unavailableAttemptNotice,
} from '@libs/game-puzzle-harness-ts/offline-observations';
import {
  namedPackProgress,
  rememberedPositionRestored,
} from '@libs/game-puzzle-harness-ts/pack-progress-observations';
import { Given, Then, When } from './world';

Given("Alice's phone has no connection", async (w) => {
  await w.run.apply(contentDeviceOffline, 'alice:phone');
});

Given(
  'Alice has created and saved the private puzzle draft {string} on her offline phone',
  async (w, title: string) => {
    await w.run.apply(arrangeOfflineDraft, title);
  }
);

Given(
  'Alice has saved the pack order {string} on her offline phone',
  async (w, titles: string) => {
    await w.run.apply(arrangeNamedPack, {
      title: 'Rivers',
      titles: 'River, Valley',
    });
    await w.run.apply(contentDeviceOffline, 'alice:phone');
    await w.run.apply(saveNamedPackOrder, 'alice:phone', titles);
  }
);

Given(
  'Bob has made progress in the published puzzle {string} on his offline phone',
  async (w, title: string) => {
    await w.run.apply(arrangeOfflinePlay, title);
  }
);

Given(
  "Bob's phone has no connection and has never had the puzzle {string}",
  async (w, _title: string) => {
    await w.run.apply(arrangeUnavailableOfflinePuzzle);
  }
);

Given(
  'Bob has completed {string} on his offline phone in the published pack {string} containing {string}',
  async (w, title: string, pack: string, puzzles: string) => {
    await w.run.apply(arrangeOfflinePackCompletion, { title, pack, puzzles });
  }
);

Given(
  "Bob's phone and tablet had the same unfinished puzzle attempt",
  async (w) => {
    await w.run.apply(arrangePersonalAttempt, { title: 'River', fresh: true });
    await w.run.apply(copyAttemptToTablet);
    await w.run.until((s) => currentAttemptView(s, 'bob:tablet'), {
      pred: (view) => view?.state === 'count:0',
      maxMs: 5000,
    });
  }
);

Given('Bob has continued that attempt on his phone', async (w) => {
  await w.run.apply(changeContentAttempt, 'bob:phone', {
    kind: 'play',
    action: 'step1',
  });
});

When('Alice reopens the app', async (w) => {
  await w.run.apply(reopenContentDevice, 'alice:phone');
});

When("Alice's phone is back online", async (w) => {
  await w.run.apply(contentDeviceOnline, 'alice:phone');
});

When("Bob's phone is back online", async (w) => {
  await w.run.apply(contentDeviceOnline, 'bob:phone');
});

When("Bob continues from his tablet's earlier position", async (w) => {
  await w.run.apply(changeContentAttempt, 'bob:tablet', {
    kind: 'play',
    action: 'step2',
  });
});

Then(
  'Alice can resume editing her private puzzle draft {string}',
  async (w, title: string) => {
    expect(await w.run.read(contentDraftAvailable, 'alice:phone', title)).toBe(
      true
    );
  }
);

Then('Bob can resume that unfinished puzzle position', async (w) => {
  expect(await w.run.read(rememberedPositionRestored, 'bob:phone')).toBe(true);
});

Then('Bob is told to reconnect to get that puzzle', async (w) => {
  expect(await w.run.read(unavailableAttemptNotice, 'bob:phone')).toBe(
    'Reconnect to get this puzzle. Your saved attempts are kept.'
  );
});

Then("Bob's other saved attempts are kept", async (w) => {
  expect(await w.run.read(rememberedPositionRestored, 'bob:phone')).toBe(true);
});

Then(
  'Alice can edit the puzzle draft {string} on her tablet',
  async (w, title: string) => {
    expect(
      await w.run.until(
        (s) => contentDraftAvailable(s, 'alice:tablet', title),
        { pred: Boolean, maxMs: 5000 }
      )
    ).toBe(true);
    await w.run.apply(openContentDraft, 'alice:tablet', title);
  }
);

Then(
  "Bob's tablet shows one completed puzzle out of two in {string}",
  async (w, pack: string) => {
    expect(
      await w.run.until((s) => namedPackProgress(s, 'bob:tablet', pack), {
        pred: (progress) => progress?.completedCount === 1,
        maxMs: 5000,
      })
    ).toMatchObject({ total: 2, completedCount: 1 });
    expect(await w.run.read(completionRecordCount, 'bob:tablet')).toBe(1);
  }
);

Then('Bob can choose either saved puzzle continuation', async (w) => {
  expect(
    await w.run.until((s) => keptAttemptStates(s, 'bob:phone'), {
      pred: (states) =>
        states.includes('count:1') && states.includes('count:2'),
      maxMs: 5000,
    })
  ).toEqual(expect.arrayContaining(['count:1', 'count:2']));
});
