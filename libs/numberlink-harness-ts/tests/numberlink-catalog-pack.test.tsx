import { expect, test } from 'bun:test';
import {
  attemptOnDevice,
  packProgressOnDevice,
  playOnDevice,
  shippedEditions,
} from '@libs/game-puzzle-harness-ts/content-game-reads';
import { waitForContent } from '@libs/game-puzzle-harness-ts/content-sync';
import {
  type ContentHarness,
  createContentWorld,
} from '@libs/game-puzzle-harness-ts/content-system';
import { createContentApp } from '@libs/game-puzzle-harness-ts/example-app';
import { mountContentExample } from '@libs/game-puzzle-harness-ts/mount-content-example';
import { contentDeviceOffline } from '@libs/game-puzzle-harness-ts/offline-actions';
import { initialNumberlinkDefinition } from '@libs/numberlink-client-ts/numberlink-editor-actions';
import { numberlinkGameClient } from '@libs/numberlink-client-ts/numberlink-game-client';
import { parseNumberlinkNotation } from '@libs/numberlink-shared-ts/numberlink-notation';
import { numberlinkPuzzleContent } from '@libs/numberlink-shared-ts/numberlink-puzzle-content';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { defineRuntime } from '@pkgs/harness-root-shared-ts/define-runtime';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import { syncVirtual } from '@pkgs/sync-engine-harness-ts/scenario-boot';
import { fireEvent } from '@solidjs/testing-library';

const BOB = 'bob:phone';
const PACK = 'First threads';
const client = numberlinkGameClient.puzzleContent;
if (client === undefined) throw new Error('Numberlink has no puzzle client');

type View = Awaited<ReturnType<typeof mountContentExample>>;

async function click(s: ContentHarness, view: View, id: string) {
  await waitForContent(s, async () => {
    const element = view.queryByTestId(id);
    return element !== null && !element.hasAttribute('disabled');
  });
  fireEvent.click(view.getByTestId(id));
}

/** How many paths the attempt's saved progress holds. */
async function savedPaths(
  s: ContentHarness,
  attemptId: string | null
): Promise<number> {
  const saved =
    attemptId === null ? null : await attemptOnDevice(s, BOB, attemptId);
  if (saved === null) return 0;
  const progress = numberlinkPuzzleContent.statistics?.(
    saved.definition,
    saved.state
  );
  return Number(progress?.['connectedPairs'] ?? 0);
}

/** Draws one witness path with the board's keyboard: choose, step, finish. */
async function draw(
  s: ContentHarness,
  view: View,
  path: { readonly width: number; readonly action: string }
) {
  const { cells } = JSON.parse(path.action) as {
    cells: { x: number; y: number }[];
  };
  const id = (index: number) =>
    `numberlink-board-cell-${cells[index]!.y * path.width + cells[index]!.x}`;
  const cell = (index: number) => view.getByTestId(id(index));
  await click(s, view, id(0));
  for (let index = 1; index < cells.length; index += 1) {
    const step = cells[index]!;
    const from = cells[index - 1]!;
    const key =
      step.x > from.x
        ? 'ArrowRight'
        : step.x < from.x
          ? 'ArrowLeft'
          : step.y > from.y
            ? 'ArrowDown'
            : 'ArrowUp';
    fireEvent.keyDown(cell(index - 1), { key });
  }
  fireEvent.click(cell(cells.length - 1));
}

/** From the library: the shipped pack, its puzzle, a new attempt, every path drawn. */
const playShippedPuzzle = defineAction({
  name: 'playShippedPuzzle',
  act: async (s: ContentHarness, title: string) => {
    const pack = shippedEditions(s).revisions.find(
      (entry) => entry.kind === 'pack' && entry.title === PACK
    );
    const item = (await packProgressOnDevice(s, BOB, PACK))?.items.find(
      (entry) => entry.title === title
    );
    const puzzle = numberlinkPuzzleContent.bundledPacks?.[0]?.puzzles.find(
      (entry) => entry.title === title
    );
    if (!pack || !item || !puzzle) throw new Error(`${title} is not shipped`);
    const view = await mountContentExample(s, BOB);
    await click(s, view, `content-bundled-${pack.document_id}`);
    await click(s, view, `content-pack-puzzle-${item.revisionId}`);
    // The edition screen previews the board; its attempt opens after starting.
    await click(s, view, 'content-start-attempt');
    await click(s, view, 'content-continue-attempt');
    await waitForContent(
      s,
      async () =>
        view
          .queryByTestId('content-attempt')
          ?.querySelector('[data-testid="numberlink-board"]') != null
    );
    const attemptId = view
      .getByTestId('content-attempt')
      .getAttribute('data-attemptid');
    const board = parseNumberlinkNotation(puzzle.definition);
    if (!board.valid) throw new Error(`${title} cannot be read`);
    for (const [index, action] of puzzle.witness.entries()) {
      await draw(s, view, { width: board.value.width, action });
      // Each path is saved before the next is drawn, as a person waits for it.
      await waitForContent(
        s,
        async () => (await savedPaths(s, attemptId)) === index + 1
      );
    }
    await waitForContent(s, async () =>
      (await playOnDevice(s, BOB)).completions.some(
        (entry) => entry.puzzle_revision_id === item.revisionId
      )
    );
    view.unmount();
  },
});

const catalogSystem = defineSystem<ContentHarness>({
  name: 'numberlink-catalog',
  actions: [playShippedPuzzle, contentDeviceOffline],
  runtimes: [
    defineRuntime({ name: 'virtual', default: true, create: syncVirtual }),
  ],
  create: (session) =>
    createContentWorld(
      session,
      { initialContent: true },
      {
        id: 'numberlink',
        title: 'Numberlink',
        client,
        content: () => numberlinkPuzzleContent,
        app: (content) =>
          createContentApp([
            {
              id: 'numberlink',
              content,
              sample: initialNumberlinkDefinition(),
            },
          ]),
      }
    ),
});

test('an offline guest completes a shipped catalog puzzle from its pack and is offered the next', async () => {
  await using run = await catalogSystem.run({ seed: 'numberlink-catalog' });
  await run.apply(contentDeviceOffline, BOB);
  await run.apply(playShippedPuzzle, 'First threads 9');
  const progress = await run.read((s) => packProgressOnDevice(s, BOB, PACK));
  expect(progress?.total).toBe(32);
  expect(progress?.completedCount).toBe(1);
  expect(
    progress?.items.find((entry) => entry.title === 'First threads 9')?.status
  ).toBe('completed');
  expect(progress?.next?.title).toBe('First threads 1');
});
