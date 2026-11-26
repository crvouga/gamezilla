import {
  StoryPackAttempt,
  type StoryPackPuzzle,
} from '@libs/game-puzzle-client-ts/content-attempt-story.example';
import type { PuzzlePlayerProps } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { numberlinkPuzzleContent } from '@libs/numberlink-shared-ts/numberlink-puzzle-content';
import type { JSX } from '@solidjs/web';
import { createSignal, untrack } from 'solid-js';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { numberlinkContentFrame } from './numberlink-content-frame';
import { NumberlinkPlayer, NumberlinkSupport } from './numberlink-player';

const { rules } = numberlinkPuzzleContent;
type ShippedPuzzle = NonNullable<
  typeof numberlinkPuzzleContent.bundledPacks
>[number]['puzzles'][number];

/** A shipped puzzle by pack and position, with what its pack screen says of it. */
function shipped(packIndex: number, position: number) {
  const pack = numberlinkPuzzleContent.bundledPacks?.[packIndex];
  const puzzle = pack?.puzzles[position - 1];
  if (pack === undefined || puzzle === undefined)
    throw new Error('Missing Numberlink catalog puzzle');
  const story: StoryPackPuzzle = {
    title: puzzle.title,
    difficulty: puzzle.difficulty,
    description: puzzle.description,
    pack: { title: pack.title, position, total: pack.puzzles.length },
  };
  return { puzzle, story, next: pack.puzzles[position]?.title };
}

/** The position after the puzzle's own witness, or the start. */
function played(puzzle: ShippedPuzzle, solved: boolean): string {
  let change = rules.initial(puzzle.definition);
  for (const action of solved ? puzzle.witness : [])
    if (change.accepted)
      change = rules.apply(puzzle.definition, change.state, action);
  if (!change.accepted) throw new Error('A shipped witness was refused');
  return change.state;
}

function figures(definition: string, state: string) {
  const values = numberlinkPuzzleContent.statistics?.(definition, state) ?? {};
  return Object.entries(numberlinkContentFrame.stats).map(([key, label]) => ({
    key,
    label: label(),
    value: String(values[key] ?? 0),
  }));
}

/** The shipped puzzle under the real rules: each committed gesture is applied and shown. */
function CatalogAttempt(
  props: PuzzlePlayerProps & {
    readonly entry: ReturnType<typeof shipped>;
  }
): JSX.Element {
  const entry = untrack(() => props.entry);

  const [state, setState] = createSignal(untrack(() => props.state));
  const onAction = (action: string) => {
    const next = rules.apply(props.definition, state(), action);
    if (next.accepted) setState(next.state);
    props.onAction(action);
  };
  return (
    <StoryPackAttempt
      puzzle={entry.story}
      complete={rules.complete(props.definition, state())}
      played={state() !== played(entry.puzzle, false)}
      figures={figures(props.definition, state())}
      figuresPlacement={numberlinkContentFrame.figuresPlacement}
      {...(entry.next === undefined
        ? {}
        : { next: { title: entry.next, open: fn() } })}
      player={
        <NumberlinkPlayer {...props} onAction={onAction} state={state()} />
      }
      support={
        <NumberlinkSupport {...props} onAction={onAction} state={state()} />
      }
    />
  );
}

const meta = {
  id: 'screens-games-numberlink-catalog',
  title: 'Screens/Space/Boards/Numberlink/Catalog',
  component: NumberlinkPlayer,
  tags: ['autodocs'],
  parameters: { appRouter: true },
} satisfies Meta<typeof NumberlinkPlayer>;
export default meta;
type Story = StoryObj<typeof meta>;

function catalogStory(packIndex: number, position: number, solved = false) {
  const entry = shipped(packIndex, position);
  return {
    args: {
      definition: entry.puzzle.definition,
      state: played(entry.puzzle, solved),
      disabled: false,
      onAction: fn(),
    },
    render: (args: PuzzlePlayerProps) => (
      <CatalogAttempt {...args} entry={entry} />
    ),
  } satisfies Story;
}

/** The first five-by-five board of the first pack, ready to draw. */
export const FirstThreads: Story = { ...catalogStory(0, 9) };

/** A shipped open-field board, joined by its witness: empty cells may stay. */
export const OpenFieldsSolved: Story = {
  ...catalogStory(9, 1, true),
};

/** The first fifteen-by-fifteen marathon board, fresh. */
export const Marathon: Story = { ...catalogStory(19, 1) };

/** The same marathon board joined by its witness. */
export const MarathonSolved: Story = {
  ...catalogStory(19, 1, true),
};
