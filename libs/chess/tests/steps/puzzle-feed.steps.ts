/**
 * The puzzle feed and the pool behind it: what the pool holds, how the feed
 * is customized, what it serves (and in what order), and an empty or
 * exhausted feed.
 */

import { expect } from 'bun:test';
import { PUZZLE_RATING_DEFAULT_RD } from '@libs/chess/public/chess-puzzle-rating';
import {
  type ChessPuzzleTheme,
  isChessPuzzleTheme,
} from '@libs/chess/public/chess-puzzle-themes';
import {
  type Puzzle,
  validateStoredPuzzleRow,
} from '@libs/chess/public/puzzle-data';
import {
  PUZZLE_WINDOW_HALF_MAX,
  PUZZLE_WINDOW_HALF_MIN,
  puzzleSelectionHalfWindow,
} from '@libs/chess/public/puzzle-session';
import {
  bumpPuzzleFeedCustomRating,
  bumpPuzzleFeedOffset,
  closePuzzleFeedSettings,
  closePuzzleFeedSettingsNoWait,
  includePlayedPuzzles,
  openPuzzleFeedSettings,
  openPuzzleFromSpaceNoWait,
  playUntilSolved,
  pressPuzzleNext,
  setPuzzleFeedHistory,
  setPuzzleFeedMode,
  setPuzzleFeedTheme,
  skipPuzzle,
} from '@libs/chess/sim/chess-actions';
import {
  ingestChessPuzzleCsv,
  readLocalPuzzles,
  readPuzzleBoardOrientation,
  readServerPuzzles,
  type StoredPuzzleRow,
} from '@libs/chess/sim/chess-puzzle-data';
import {
  type FeedHistoryFilter,
  readFeedHistoryLabel,
  readFeedModalPool,
  readFeedModalTargetRating,
  readFeedOffsetValue,
  readFeedTargetLabel,
} from '@libs/chess/sim/chess-puzzle-feed-ui';
import {
  isEmptyPoolVisible,
  isPuzzleAttemptRated,
  readActivePuzzleId,
  readPuzzleDebug,
  readPuzzlePickSource,
  readPuzzleSelectionWindow,
} from '@libs/chess/sim/chess-puzzle-ui';
import { readServerPuzzleProfile } from '@libs/chess/sim/chess-rating-data';
import {
  type Actor,
  Given,
  type SimWorld,
  Then,
  When,
} from '@libs/sim-harness/spec/define';
import { remember } from '@libs/sim-harness/spec/world';
import { createSpace } from '@libs/spaces/sim/space-actions';
import {
  FULL_INGEST_ROWS,
  INGEST_ROWS,
  type IngestRow,
  ingestCsv,
  RATING_CSV,
  SELECTION_CSV,
  SELECTION_GROUPS,
  STANDARD_PUZZLE_IDS,
} from './puzzle-fixtures';
import {
  activePuzzle,
  cutConnection,
  lastPlayer,
  puzzleOwner,
  recalled,
  recordServed,
  required,
  SECOND_MS,
  SERVABLE_KEY,
  SETTLE_MS,
  servedInPass,
  trackPuzzle,
} from './puzzle-world';

const IMPORTED = 'importedRows';
const IMPORTED_CSV = 'importedCsv';
const POOL_IDS = 'poolIds';
const LOW_QUALITY = 'lowQualityPuzzles';
const IN_WINDOW = 'inWindowPuzzles';
const OUT_OF_WINDOW = 'outOfWindowPuzzles';
const beforeRepeatKey = (actor: Actor) => `profileBeforeRepeat:${actor}`;
const servedSidesKey = (actor: Actor) => `servedSides:${actor}`;

/** A stored row as a validated puzzle; a row that fails validation fails. */
function validated(row: StoredPuzzleRow): Puzzle {
  const result = validateStoredPuzzleRow(row);
  if (!result.ok) {
    throw new Error(`stored puzzle ${row.id} invalid: ${result.detail}`);
  }
  return result.puzzle;
}

/** Every stored row passes validation and no position and line repeats. */
function expectAllValid(rows: readonly StoredPuzzleRow[]): Puzzle[] {
  const puzzles = rows.map(validated);
  expect(new Set(puzzles.map((p) => p.positionKey)).size).toBe(puzzles.length);
  return puzzles;
}

async function serverPoolIds(w: SimWorld): Promise<string[]> {
  return (await w.s.read(readServerPuzzles)).map((row) => row.id);
}

async function importFile(w: SimWorld, rows: readonly IngestRow[]) {
  const csv = remember(w, IMPORTED_CSV, ingestCsv(rows));
  remember(w, IMPORTED, rows);
  await w.s.apply(ingestChessPuzzleCsv, csv);
  remember(w, POOL_IDS, await serverPoolIds(w));
}

function historyFilter(label: string): FeedHistoryFilter {
  const filters: Partial<Record<string, FeedHistoryFilter>> = {
    Any: 'any',
    Unseen: 'neverSeen',
    Seen: 'seen',
    Failed: 'failed',
  };
  const filter = filters[label];
  if (filter === undefined) throw new Error(`no history filter "${label}"`);
  return filter;
}

function theme(name: string): ChessPuzzleTheme {
  if (!isChessPuzzleTheme(name)) throw new Error(`no puzzle theme "${name}"`);
  return name;
}

async function untilFeedTarget(
  w: SimWorld,
  actor: Actor,
  mode: 'auto' | 'custom',
  rating: number
): Promise<void> {
  await w.s.until(async (surf) => readFeedTargetLabel(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (label) => label?.mode === mode && label.rating === rating,
  });
  expect(await w.s.read(readFeedTargetLabel, actor)).toEqual({ mode, rating });
}

/** Finish the puzzle on the board (solve or skip) and move on. */
async function attemptAndAdvance(
  w: SimWorld,
  actor: Actor,
  solve: boolean
): Promise<void> {
  // A skip abandons (zero credit); a wrong move would score half.
  await w.s.apply(solve ? playUntilSolved : skipPuzzle, actor);
  await w.s.apply(pressPuzzleNext, actor);
  await trackPuzzle(w, actor);
}

async function untilExhausted(w: SimWorld, actor: Actor, seconds: number) {
  await w.s.until(async (surf) => readPuzzlePickSource(surf, actor), {
    maxMs: seconds * SECOND_MS,
    pred: (source) => source === 'exhausted',
  });
  const owner = await puzzleOwner(w, actor);
  remember(
    w,
    beforeRepeatKey(actor),
    await w.s.read(readServerPuzzleProfile, owner)
  );
}

// ----------------------------------------------------------- the pool

Given('the puzzle pool was seeded at boot', async (w) => {
  expect(await serverPoolIds(w)).not.toEqual([]);
});

Given('the puzzle pool holds the three standard puzzles', async (w) => {
  expect(await serverPoolIds(w)).toEqual([...STANDARD_PUZZLE_IDS]);
});

Given('the puzzle pool holds puzzles rated near 1500', async (w) => {
  await w.s.apply(ingestChessPuzzleCsv, RATING_CSV);
});

Given(
  'the puzzle pool also holds:',
  async (w, table: readonly (readonly string[])[]) => {
    const [header, ...rows] = table;
    expect(header).toEqual(['puzzles', 'rated', 'quality']);
    const groups = rows.map(([count, rated, quality]) => {
      const group = Object.values(SELECTION_GROUPS).find(
        (g) => g.rated === rated && g.quality === quality
      );
      if (group === undefined) {
        throw new Error(
          `no fixture puzzles rated ${rated ?? ''}, ${quality ?? ''}`
        );
      }
      expect<number>(group.ids.length).toBe(Number(count));
      return group;
    });
    expect(new Set(groups).size).toBe(Object.keys(SELECTION_GROUPS).length);
    await w.s.apply(ingestChessPuzzleCsv, SELECTION_CSV);
    remember(w, IN_WINDOW, SELECTION_GROUPS.goodNear1500.ids);
    remember(w, OUT_OF_WINDOW, SELECTION_GROUPS.good1800To1900.ids);
    remember(w, LOW_QUALITY, SELECTION_GROUPS.lowQuality.ids);
    remember(w, SERVABLE_KEY, [
      ...SELECTION_GROUPS.goodNear1500.ids,
      ...SELECTION_GROUPS.good1800To1900.ids,
      ...STANDARD_PUZZLE_IDS,
    ]);
  }
);

Then(
  "every puzzle in the pool has reached {actor}'s device within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    const pool = await serverPoolIds(w);
    await w.s.until(
      async (surf) =>
        new Set((await readLocalPuzzles(surf, actor)).map((row) => row.id)),
      {
        maxMs: seconds * SECOND_MS,
        pred: (local) => pool.every((id) => local.has(id)),
      }
    );
  }
);

// ---------------------------------------------------------------- ingest

When(
  'a puzzle file is imported with these puzzles:',
  async (w, table: readonly (readonly string[])[]) => {
    const [header, ...rows] = table;
    expect(header).toEqual(['puzzle', 'valid']);
    const chosen = rows.map(([name, valid]) => {
      const row = INGEST_ROWS[name ?? ''];
      if (row === undefined)
        throw new Error(`no fixture puzzle "${name ?? ''}"`);
      expect(row.valid).toBe(valid === 'yes');
      return row;
    });
    await importFile(w, chosen);
  }
);

Given(
  'a puzzle file with two valid puzzles and five invalid ones has been imported',
  async (w) => {
    expect(FULL_INGEST_ROWS.filter((row) => row.valid)).toHaveLength(2);
    expect(FULL_INGEST_ROWS.filter((row) => !row.valid)).toHaveLength(5);
    await importFile(w, FULL_INGEST_ROWS);
  }
);

When('the same puzzle file is imported again', async (w) => {
  await w.s.apply(ingestChessPuzzleCsv, recalled<string>(w, IMPORTED_CSV));
});

Then(
  "the server's puzzle pool is exactly the three standard puzzles",
  async (w) => {
    expect(await serverPoolIds(w)).toEqual([...STANDARD_PUZZLE_IDS]);
  }
);

Then(
  "the server's puzzle pool is the three standard puzzles plus the two valid imports",
  async (w) => {
    const valid = recalled<readonly IngestRow[]>(w, IMPORTED)
      .filter((row) => row.valid)
      .map((row) => row.id);
    expect(valid).toHaveLength(2);
    expect(await serverPoolIds(w)).toEqual(
      [...STANDARD_PUZZLE_IDS, ...valid].sort()
    );
  }
);

Then('none of the rejected puzzles is in the pool', async (w) => {
  const ids = await serverPoolIds(w);
  for (const row of recalled<readonly IngestRow[]>(w, IMPORTED)) {
    if (!row.valid) expect(ids).not.toContain(row.id);
  }
});

Then(
  'every stored puzzle is valid and no position and line repeats',
  async (w) => {
    expectAllValid(await w.s.read(readServerPuzzles));
  }
);

Then("the server's puzzle pool is unchanged", async (w) => {
  expect(await serverPoolIds(w)).toEqual(recalled<string[]>(w, POOL_IDS));
});

type ServedSide = {
  readonly id: string;
  /** Every synced row valid, and the served one among them. */
  readonly synced: boolean;
  readonly solver: 'w' | 'b' | null;
  readonly orientation: 'white' | 'black' | null;
};

async function servedSide(w: SimWorld, actor: Actor): Promise<ServedSide> {
  const id = await activePuzzle(w, actor);
  const local = await w.s.read(readLocalPuzzles, actor);
  const row = local.find((r) => r.id === id);
  const synced =
    row !== undefined &&
    local.every((r) => validateStoredPuzzleRow(r).ok) &&
    new Set(local.map((r) => validated(r).positionKey)).size === local.length;
  return {
    id,
    synced,
    solver: row === undefined ? null : validated(row).solverColor,
    orientation: await w.s.read(readPuzzleBoardOrientation, actor),
  };
}

When(
  '{actor} skips puzzles until they have been served one White solves and one Black solves',
  async (w, actor: Actor) => {
    const served = [await servedSide(w, actor)];
    const pool = (await serverPoolIds(w)).length;
    const sides = () => new Set(served.map((s) => s.solver));
    for (
      let step = 0;
      step < pool && !(sides().has('w') && sides().has('b'));
      step += 1
    ) {
      await w.s.apply(skipPuzzle, actor);
      await w.s.apply(pressPuzzleNext, actor);
      await trackPuzzle(w, actor);
      served.push(await servedSide(w, actor));
    }
    remember(w, servedSidesKey(actor), served);
    expect([...sides()].sort()).toEqual(['b', 'w']);
  }
);

Then(
  'every puzzle {actor} was served was a valid synced puzzle',
  async (w, actor: Actor) => {
    for (const served of recalled<readonly ServedSide[]>(
      w,
      servedSidesKey(actor)
    )) {
      expect({ id: served.id, synced: served.synced }).toEqual({
        id: served.id,
        synced: true,
      });
    }
  }
);

Then("{actor}'s board faced the solver each time", async (w, actor: Actor) => {
  for (const served of recalled<readonly ServedSide[]>(
    w,
    servedSidesKey(actor)
  )) {
    expect({ id: served.id, orientation: served.orientation }).toEqual({
      id: served.id,
      orientation: served.solver === 'w' ? 'white' : 'black',
    });
  }
});

// ------------------------------------------------------------ feed settings

Then(
  "{actor}'s feed history shows {string}",
  async (w, actor: Actor, label: string) => {
    expect(await w.s.read(readFeedHistoryLabel, actor)).toBe(label);
  }
);

When(
  '{actor} changes the feed history to {string} and saves the feed settings',
  async (w, actor: Actor, label: string) => {
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedHistory, actor, historyFilter(label));
    await w.s.apply(closePuzzleFeedSettings, actor);
    await trackPuzzle(w, actor);
  }
);

Then(
  "{actor}'s feed targets {int} automatically",
  async (w, actor: Actor, rating: number) => {
    await untilFeedTarget(w, actor, 'auto', rating);
  }
);

Then(
  "{actor}'s feed targets a custom {int}",
  async (w, actor: Actor, rating: number) => {
    await untilFeedTarget(w, actor, 'custom', rating);
  }
);

When('{actor} starts editing the feed settings', async (w, actor: Actor) => {
  await w.s.apply(openPuzzleFeedSettings, actor);
});

When('{actor} saves the feed settings', async (w, actor: Actor) => {
  await w.s.apply(closePuzzleFeedSettings, actor);
  await trackPuzzle(w, actor);
});

Then(
  "{actor}'s feed rating offset is {int}",
  async (w, actor: Actor, offset: number) => {
    expect(await w.s.read(readFeedOffsetValue, actor)).toBe(offset);
  }
);

When(
  '{actor} raises the feed rating offset by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(bumpPuzzleFeedOffset, actor, steps);
  }
);

Then(
  "{actor}'s unsaved feed settings preview a target of {int}",
  async (w, actor: Actor, rating: number) => {
    expect(await w.s.read(readFeedModalTargetRating, actor)).toBe(rating);
  }
);

When(
  '{actor} switches the feed to a custom target raised by {int} step(s) and saves the feed settings',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedMode, actor, 'custom');
    await w.s.apply(bumpPuzzleFeedCustomRating, actor, steps);
    await w.s.apply(closePuzzleFeedSettings, actor);
    await trackPuzzle(w, actor);
  }
);

Then(
  "{actor}'s feed settings show a pool of at least one matching puzzle",
  async (w, actor: Actor) => {
    const pool = required(await w.s.read(readFeedModalPool, actor), 'pool');
    expect(pool.matched).toBeGreaterThan(0);
  }
);

Then(
  '{actor} is solving a puzzle rated between {int} and {int}',
  async (w, actor: Actor, low: number, high: number) => {
    const debug = required(await w.s.read(readPuzzleDebug, actor), 'puzzle');
    expect(debug.status).toBe('solving');
    const rating = required(debug.puzzleRating, 'puzzle rating');
    expect(rating).toBeGreaterThanOrEqual(low);
    expect(rating).toBeLessThanOrEqual(high);
  }
);

// ------------------------------------------------------------ empty feeds

When(
  '{actor} limits the feed to the {string} theme',
  async (w, actor: Actor, name: string) => {
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedTheme, actor, theme(name));
    await w.s.apply(closePuzzleFeedSettingsNoWait, actor);
  }
);

Given(
  '{actor} has limited the feed to the {string} theme and it is empty',
  async (w, actor: Actor, name: string) => {
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedTheme, actor, theme(name));
    await w.s.apply(closePuzzleFeedSettingsNoWait, actor);
    await w.s.until((surf) => isEmptyPoolVisible(surf, actor), {
      maxMs: SETTLE_MS,
    });
    expect(await w.s.read(readActivePuzzleId, actor)).toBeNull();
  }
);

Then(
  '{actor} is told the feed is empty within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((surf) => isEmptyPoolVisible(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then('{actor} is not told the feed is empty', async (w, actor: Actor) => {
  expect(await w.s.read(isEmptyPoolVisible, actor)).toBe(false);
});

When(
  '{actor} includes puzzles they have already played',
  async (w, actor: Actor) => {
    await w.s.apply(includePlayedPuzzles, actor);
    await trackPuzzle(w, actor);
  }
);

When(
  '{actor} opens puzzles in their space without waiting for a puzzle',
  async (w, actor: Actor) => {
    await w.s.apply(openPuzzleFromSpaceNoWait, actor);
  }
);

Given(
  "{actor}'s feed is empty because they went offline before any puzzles arrived",
  async (w, actor: Actor) => {
    await w.s.apply(createSpace, actor);
    await cutConnection(w, actor);
    await w.s.apply(openPuzzleFromSpaceNoWait, actor);
    await w.s.until((surf) => isEmptyPoolVisible(surf, actor), {
      maxMs: SETTLE_MS,
    });
    expect(await w.s.read(readActivePuzzleId, actor)).toBeNull();
  }
);

// ------------------------------------------------- passes through the pool

When('{actor} solves every puzzle in the pool', async (w, actor: Actor) => {
  const pool = (await serverPoolIds(w)).length;
  for (let i = 0; i < pool; i += 1) {
    await recordServed(w, actor);
    await w.s.apply(playUntilSolved, actor);
    if (i < pool - 1) {
      await w.s.apply(pressPuzzleNext, actor);
      await trackPuzzle(w, actor);
    }
  }
});

When(
  '{actor} plays through every servable puzzle, alternately solving and skipping',
  async (w, actor: Actor) => {
    const servable = recalled<readonly string[]>(w, SERVABLE_KEY);
    for (let i = 0; i < servable.length; i += 1) {
      await recordServed(w, actor);
      await attemptAndAdvance(w, actor, i % 2 === 0);
    }
  }
);

When(
  '{actor} plays {int} puzzles, alternately solving and skipping',
  async (w, actor: Actor, count: number) => {
    for (let i = 0; i < count; i += 1) {
      await attemptAndAdvance(w, actor, i % 2 === 0);
    }
  }
);

Then(
  'every puzzle {actor} was served was new to them and rated',
  async (w, actor: Actor) => {
    const served = servedInPass(w, actor);
    expect(served.length).toBeGreaterThan(0);
    expect(new Set(served.map((s) => s.id)).size).toBe(served.length);
    for (const s of served) expect(s).toEqual({ id: s.id, rated: true });
  }
);

Then('every puzzle {actor} was served was rated', async (w, actor: Actor) => {
  const served = servedInPass(w, actor);
  expect(served.length).toBeGreaterThan(0);
  for (const s of served) expect(s).toEqual({ id: s.id, rated: true });
});

Then('no puzzle was served to {actor} twice', async (w, actor: Actor) => {
  const ids = servedInPass(w, actor).map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.length).toBe(recalled<readonly string[]>(w, SERVABLE_KEY).length);
});

Then(
  'none of the low-quality puzzles was served to {actor}',
  async (w, actor: Actor) => {
    const ids = servedInPass(w, actor).map((s) => s.id);
    for (const low of recalled<readonly string[]>(w, LOW_QUALITY)) {
      expect(ids).not.toContain(low);
    }
  }
);

Then(
  'every good puzzle near 1500 was served before any puzzle rated 1800 to 1900',
  async (w) => {
    const ids = servedInPass(w, lastPlayer(w)).map((s) => s.id);
    const inWindow = recalled<readonly string[]>(w, IN_WINDOW);
    const outOfWindow = recalled<readonly string[]>(w, OUT_OF_WINDOW);
    for (const id of [...inWindow, ...outOfWindow]) expect(ids).toContain(id);
    const lastInWindow = Math.max(...inWindow.map((id) => ids.indexOf(id)));
    const firstOutOfWindow = Math.min(
      ...outOfWindow.map((id) => ids.indexOf(id))
    );
    expect(lastInWindow).toBeLessThan(firstOutOfWindow);
  }
);

Then(
  "{actor}'s feed comes round to the first puzzle they played within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await untilExhausted(w, actor, seconds);
    const first = required(servedInPass(w, actor)[0], 'a first puzzle').id;
    expect(await w.s.read(readActivePuzzleId, actor)).toBe(first);
    await trackPuzzle(w, actor);
  }
);

Then(
  "{actor}'s feed comes round to a puzzle they already played within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await untilExhausted(w, actor, seconds);
    const played = servedInPass(w, actor).map((s) => s.id);
    expect(played).toContain(await activePuzzle(w, actor));
    await trackPuzzle(w, actor);
  }
);

Then("{actor}'s current attempt is unrated", async (w, actor: Actor) => {
  expect(await w.s.read(isPuzzleAttemptRated, actor)).toBe(false);
});

Then(
  "{actor}'s server rating and deviation are unchanged by the repeat",
  async (w, actor: Actor) => {
    const before = required(
      recalled<Awaited<ReturnType<typeof readServerPuzzleProfile>>>(
        w,
        beforeRepeatKey(actor)
      ),
      'rating before the repeat'
    );
    const after = required(
      await w.s.read(readServerPuzzleProfile, await puzzleOwner(w, actor)),
      'server rating'
    );
    expect(after.rating).toBe(before.rating);
    expect(after.rating_deviation).toBe(before.rating_deviation);
  }
);

// ------------------------------------------------------- selection window

Then(
  "{actor}'s selection window is the widest there is",
  async (w, actor: Actor) => {
    const window = await w.s.read(readPuzzleSelectionWindow, actor);
    expect(window).toBe(puzzleSelectionHalfWindow(PUZZLE_RATING_DEFAULT_RD));
    expect(window).toBe(PUZZLE_WINDOW_HALF_MAX);
  }
);

Then(
  "{actor}'s selection window matches their server rating deviation within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    const profile = required(
      await w.s.read(readServerPuzzleProfile, await puzzleOwner(w, actor)),
      'server rating'
    );
    const expected = puzzleSelectionHalfWindow(profile.rating_deviation);
    await w.s.until(async (surf) => readPuzzleSelectionWindow(surf, actor), {
      maxMs: seconds * SECOND_MS,
      pred: (window) => window === expected,
    });
  }
);

Then(
  "{actor}'s selection window is narrower than the widest but no narrower than the narrowest",
  async (w, actor: Actor) => {
    const window = required(
      await w.s.read(readPuzzleSelectionWindow, actor),
      'selection window'
    );
    expect(window).toBeLessThan(PUZZLE_WINDOW_HALF_MAX);
    expect(window).toBeGreaterThanOrEqual(PUZZLE_WINDOW_HALF_MIN);
  }
);
