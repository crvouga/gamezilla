import { expect } from 'bun:test';
import { openPuzzleFromSpace } from '@libs/chess-puzzle-harness/chess-actions';
import { readPuzzleStatus } from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import {
  otherPuzzleEnvironmentUnchanged,
  prepareOtherPuzzleEnvironment,
} from '@libs/chess-root-harness/puzzle-import-environments';
import { preparePuzzleImport } from '@libs/chess-root-harness/puzzle-import-setup';
import {
  chooseBrokenUpdates,
  followPuzzleImport,
  readEnvironmentPuzzleImport,
  readPuzzleImport,
  startPuzzleLoading,
  stopPuzzleLoading,
} from '@libs/chess-root-harness/puzzle-import-ui';
import {
  advancePuzzleImport,
  failPuzzleImport,
  finishPuzzleImport,
  joinPuzzleTeam,
  readImportPool,
} from '@libs/chess-root-harness/puzzle-import-world';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  createSpace,
  reopenSpaceLink,
} from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';

const BASELINE = 'puzzle-management:baseline';
async function onTeam(w: HarnessWorld, actor: Actor) {
  await w.s.apply(signInWithGoogle, actor);
  await w.s.apply(joinPuzzleTeam, actor);
  w.memo.set(BASELINE, await w.s.read(readImportPool));
  await w.s.apply(createSpace, actor);
  w.memo.set(
    'puzzle-management:solver-space',
    await w.s.read(readSpaceLink, actor)
  );
  await w.s.apply(followPuzzleImport, actor);
  await w.s.until((s) => readPuzzleImport(s, actor), {
    pred: (view) => !view.denied,
    maxMs: 15000,
  });
}
async function ongoing(w: HarnessWorld) {
  await w.s.apply(preparePuzzleImport);
}
Given('{actor} is on the team for this environment', onTeam);
Given(
  '{actor} is signed in and not on the team for this environment',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
    w.memo.set(BASELINE, await w.s.read(readImportPool));
    await w.s.apply(followPuzzleImport, actor);
  }
);
Given('this environment is ready to add puzzles', async (w) => {
  expect((await w.s.read(readPuzzleImport)).status).toBe('ready');
});
Given('this environment is adding puzzles', ongoing);
Given('this environment finished adding puzzles', async (w) => {
  await ongoing(w);
  await w.s.apply(finishPuzzleImport);
});
Given('this environment failed to add puzzles', async (w) => {
  await ongoing(w);
  await w.s.apply(failPuzzleImport);
});
Given('this environment stopped adding puzzles', async (w) => {
  await ongoing(w);
  await w.s.apply(stopPuzzleLoading, 'alice');
});
Given(
  'this environment has added some puzzles and is adding more',
  async (w) => {
    await ongoing(w);
    await w.s.apply(advancePuzzleImport);
  }
);
Given(
  'the chosen puzzles are broken updates of the earlier puzzles',
  async (w) => {
    await w.s.apply(chooseBrokenUpdates);
  }
);
Given(
  'adding puzzles finished while {actor} was offline',
  async (w, actor: Actor) => {
    await ongoing(w);
    await w.s.apply(partition, actor);
    await w.s.apply(finishPuzzleImport);
  }
);
Given(
  'some puzzles were added while {actor} was offline',
  async (w, actor: Actor) => {
    await ongoing(w);
    await w.s.apply(partition, actor);
    await w.s.apply(advancePuzzleImport);
  }
);
Given(
  'adding puzzles stopped while {actor} was offline',
  async (w, actor: Actor) => {
    await ongoing(w);
    await w.s.apply(signInWithGoogle, 'bob');
    await w.s.apply(joinPuzzleTeam, 'bob');
    await w.s.apply(followPuzzleImport, 'bob');
    await w.s.apply(partition, actor);
    await w.s.apply(stopPuzzleLoading, 'bob');
  }
);
When('{actor} adds puzzles to this environment', async (w, actor: Actor) => {
  await w.s.apply(startPuzzleLoading, actor);
  await w.s.apply(advancePuzzleImport);
});
When(
  '{actor} tries to add puzzles to this environment',
  async (w, actor: Actor) => {
    await w.s.apply(startPuzzleLoading, actor);
  }
);
When(
  '{actor} adds these puzzles again to this environment',
  async (w, actor: Actor) => {
    await w.s.apply(startPuzzleLoading, actor);
    await w.s.apply(finishPuzzleImport);
  }
);
When(
  '{actor} tries to stop adding puzzles to this environment',
  async (w, actor: Actor) => {
    await w.s.apply(stopPuzzleLoading, actor);
  }
);
When(
  '{actor} follows adding puzzles to this environment',
  async (w, actor: Actor) => {
    await w.s.apply(followPuzzleImport, actor);
  }
);
When('this environment adds some of the puzzles', async (w) => {
  await w.s.apply(advancePuzzleImport);
});
When('this environment finishes adding puzzles', async (w) => {
  await w.s.apply(finishPuzzleImport);
});
When('this environment fails to add puzzles', async (w) => {
  await w.s.apply(failPuzzleImport);
});
When("{actor}'s device comes back online", async (w, actor: Actor) => {
  await w.s.apply(restoreActorConnection, actor);
});
Then(
  '{actor} sees that this environment is adding puzzles',
  async (w, actor: Actor) => {
    expect((await w.s.read(readPuzzleImport, actor)).status).toBe('adding');
  }
);
Then(
  '{actor} sees that this environment stopped adding puzzles',
  async (w, actor: Actor) => {
    expect(
      (
        await w.s.until((s) => readPuzzleImport(s, actor), {
          pred: (view) => view.status === 'stopped',
          maxMs: 15000,
        })
      ).status
    ).toBe('stopped');
  }
);
Then('this environment is still adding puzzles', async (w) => {
  expect((await w.s.read(readEnvironmentPuzzleImport)).status).toBe('adding');
});
Then('this environment is not adding puzzles', async (w) => {
  expect((await w.s.read(readPuzzleImport)).status).not.toBe('adding');
});
Then(
  '{actor} is told only the team can add or stop adding puzzles',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleImport, actor)).toMatchObject({
      denied: true,
      denialText: expect.stringContaining('Only the puzzle team'),
    });
  }
);
Then(
  '{actor} is told this environment is already adding puzzles',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleImport, actor)).toMatchObject({
      status: 'adding',
      startDisabled: true,
    });
  }
);
Then('{actor} is offered to stop adding puzzles', async (w, actor: Actor) => {
  expect((await w.s.read(readPuzzleImport, actor)).stopOffered).toBe(true);
});
Then(
  '{actor} is not offered to stop adding puzzles',
  async (w, actor: Actor) => {
    expect((await w.s.read(readPuzzleImport, actor)).stopOffered).toBe(false);
  }
);
Then(
  '{actor} is told a connection is needed to add puzzles',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleImport, actor)).toMatchObject({
      offline: true,
      startDisabled: true,
    });
  }
);
Then(
  '{actor} is told a connection is needed to stop adding puzzles',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleImport, actor)).toMatchObject({
      offline: true,
      stopDisabled: true,
    });
  }
);
Then('{actor} sees how many puzzles were added', async (w, actor: Actor) => {
  expect(
    (
      await w.s.until((s) => readPuzzleImport(s, actor), {
        pred: (view) => view.added === 3,
        maxMs: 15000,
      })
    ).added
  ).toBe(3);
});
Then('{actor} sees how many puzzles were broken', async (w, actor: Actor) => {
  expect(
    (
      await w.s.until((s) => readPuzzleImport(s, actor), {
        pred: (view) => view.broken === 2,
        maxMs: 15000,
      })
    ).broken
  ).toBe(2);
});
Then(
  '{actor} sees {int} puzzles added and {int} broken puzzles',
  async (w, actor: Actor, added: number, broken: number) => {
    expect(
      await w.s.until((s) => readPuzzleImport(s, actor), {
        pred: (view) => view.added === added && view.broken === broken,
        maxMs: 15000,
      })
    ).toMatchObject({
      added,
      broken,
    });
  }
);
Then(
  '{actor} sees {int} puzzles added and {int} puzzles updated',
  async (w, actor: Actor, added: number, updated: number) => {
    expect(await w.s.read(readPuzzleImport, actor)).toMatchObject({
      added,
      updated,
    });
  }
);
Then(
  '{actor} sees {int} puzzles updated and {int} broken puzzles',
  async (w, actor: Actor, updated: number, broken: number) => {
    expect(await w.s.read(readPuzzleImport, actor)).toMatchObject({
      updated,
      broken,
    });
  }
);
Then(
  '{actor} is told adding puzzles failed and why',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleImport, actor)).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('incomplete'),
    });
  }
);
Then("this environment's puzzle pool holds the added puzzles", async (w) => {
  expect((await w.s.read(readPuzzleImport)).poolSize).toBe(
    Number(w.memo.get(BASELINE)) + 3
  );
});
Then('the puzzles already added remain available to solvers', async (w) => {
  expect((await w.s.read(readPuzzleImport)).poolSize).toBe(
    Number(w.memo.get(BASELINE)) + 3
  );
  await w.s.apply(
    reopenSpaceLink,
    'alice',
    String(w.memo.get('puzzle-management:solver-space'))
  );
  await w.s.apply(openPuzzleFromSpace, 'alice');
  expect(await w.s.read(readPuzzleStatus, 'alice')).toBe('solving');
});

Then('a solver can still play from the earlier puzzle pool', async (w) => {
  await w.s.apply(
    reopenSpaceLink,
    'alice',
    String(w.memo.get('puzzle-management:solver-space'))
  );
  await w.s.apply(openPuzzleFromSpace, 'alice');
  expect(await w.s.read(readPuzzleStatus, 'alice')).toBe('solving');
});

Given('another environment has its own puzzle pool', async (w) => {
  await w.s.apply(prepareOtherPuzzleEnvironment);
});
Then("the other environment's puzzle pool is still unchanged", async (w) => {
  expect(await w.s.read(otherPuzzleEnvironmentUnchanged)).toBe(true);
});
