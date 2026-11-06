import { encodeBattleshipPosition } from '@libs/battleship-shared-ts/battleship-position';
import {
  battleshipRules,
  resolveBattleshipShot,
} from '@libs/battleship-shared-ts/battleship-rules';
import {
  BOARD_CONTROLS_EXCLUDE,
  boardArgs,
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import {
  type GameSetups,
  TWO_PLAYER_SIDES,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { createSignal, mergeProps } from 'solid-js';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { BattleshipBoard } from './battleship-board';
import { battleshipPresentation } from './battleship-presentation';
import {
  assertTargetViewport,
  assertTargetWorkbench,
} from './battleship-targeting.example';

/** Blue's fleet along rows 1, 3, 5, 7 and 9 from column A. */
const BLUE_FLEET =
  'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h';
/** Red's fleet along rows 2, 4, 6, 8 and 10 from column F. */
const RED_FLEET =
  'fleet:carrier@f2h;battleship@f4h;cruiser@f6h;submarine@f8h;destroyer@f10h';
const FLEETS: GameSetups = { white: BLUE_FLEET, black: RED_FLEET };

/** The position after `cells` are fired at in turn, Blue first, against the fleets above. */
function after(cells: readonly string[]): string {
  const actions: string[] = [];
  for (const cell of cells) {
    const action = resolveBattleshipShot(
      encodeBattleshipPosition(actions),
      cell,
      FLEETS
    );
    if (action === null) throw new Error(`Refused shot at ${cell}`);
    actions.push(action);
  }
  return encodeBattleshipPosition(actions);
}

/** The shots fired to reach `position`, as the game's record writes them. */
function recorded(position: string): readonly string[] {
  return battleshipRules.moves(position, '', []).map((move) => move.label);
}

/** Blue sinks Red's destroyer and hits its carrier; Red misses twice and hits once. */
const VOLLEYS = ['f10', 'a2', 'g10', 'b9', 'f2', 'a1', 'g2', 'c4'];
/** Every one of Red's fleet cells, Blue firing; Red misses along row 2 and 4. */
const RED_CELLS = [
  'f2',
  'g2',
  'h2',
  'i2',
  'j2',
  'f4',
  'g4',
  'h4',
  'i4',
  'f6',
  'g6',
  'h6',
  'f8',
  'g8',
  'h8',
  'f10',
  'g10',
];
const RED_MISSES = 'a2 b2 c2 d2 e2 f2 g2 h2 i2 j2 a4 b4 c4 d4 e4 f4'.split(' ');
const BLUE_VICTORY = RED_CELLS.flatMap((cell, i) => {
  const reply = RED_MISSES[i];
  return reply === undefined ? [cell] : [cell, reply];
});

const meta = {
  id: 'screens-games-battleship-board',
  title: 'Screens/Games/Battleship/Board',
  component: BattleshipBoard,
  tags: ['autodocs'],
  render: (args, context) =>
    renderGameTable(battleshipPresentation, TWO_PLAYER_SIDES, args, context),
  parameters: {
    appRouter: true,
    controls: { exclude: [...BOARD_CONTROLS_EXCLUDE] },
    table: { turn: 'white' } satisfies GameTableStory,
  },
  args: boardArgs(after([]), { interactive: true, setup: BLUE_FLEET }),
} satisfies Meta<typeof BattleshipBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The first shot: Blue fires first, so the targeting waters open at once. */
export const Opening: Story = {};

/** Mid-game on Blue's turn: a sunk destroyer, hits and misses on both boards. */
export const YourTurn: Story = {
  args: { position: after(VOLLEYS) },
  parameters: {
    table: { moves: recorded(after(VOLLEYS)) } satisfies GameTableStory,
  },
};

/** Red is firing: Blue's own fleet shows, with the shots that hit it. */
export const WaitingForOpponent: Story = {
  args: { position: after(VOLLEYS.slice(0, -1)), interactive: false },
  parameters: {
    table: {
      turn: 'black',
      moves: recorded(after(VOLLEYS.slice(0, -1))),
    } satisfies GameTableStory,
  },
};

/** A watcher sees both waters as public shots, named by fleet, and no ships. */
export const Watching: Story = {
  args: { position: after(VOLLEYS), interactive: false, setup: null },
  parameters: {
    table: {
      viewer: null,
      turn: 'white',
      moves: recorded(after(VOLLEYS)),
    } satisfies GameTableStory,
  },
};

/** Blue sinks the whole Red fleet and is told so. */
export const Won: Story = {
  play: async ({ canvasElement }) => {
    // regression: battleship-victory-hides-enemy-fleet
    await expect(
      within(canvasElement).getByTestId('custom-game-board-view-panels')
    ).toHaveAttribute('data-selected', 'target');
  },
  args: { position: after(BLUE_VICTORY), interactive: false },
  parameters: {
    table: {
      ending: { winner: 'white', reason: 'fleet sunk' },
      moves: recorded(after(BLUE_VICTORY)),
    } satisfies GameTableStory,
  },
};

/** Red's side of the same game: its whole fleet is sunk. */
export const Lost: Story = {
  args: {
    position: after(BLUE_VICTORY),
    interactive: false,
    orientation: 'black',
    setup: RED_FLEET,
  },
  parameters: {
    table: {
      ending: { winner: 'white', reason: 'fleet sunk' },
      moves: recorded(after(BLUE_VICTORY)),
    } satisfies GameTableStory,
  },
};

/** Resolve a shot with the production rules and hand the turn to Red. */
function shotJourney(
  cells: readonly string[],
  target: string,
  outcome: string,
  wins = false
): Story {
  return {
    render: (args, context) => {
      const [moves, setMoves] = createSignal([...cells]);
      const [fired, setFired] = createSignal(false);
      const board = mergeProps(args, {
        get position() {
          return after(moves());
        },
        get interactive() {
          return !fired();
        },
        onAction: (cell: string) => {
          if (fired()) return;
          setMoves([...moves(), cell]);
          setFired(true);
        },
      });
      return renderGameTable(battleshipPresentation, TWO_PLAYER_SIDES, board, {
        parameters: {
          ...context.parameters,
          table: {
            get turn() {
              return fired() ? 'black' : 'white';
            },
            get moves() {
              return recorded(after(moves()));
            },
            get ending() {
              return fired() && wins
                ? { winner: 'white' as const, reason: 'fleet sunk' }
                : undefined;
            },
          } satisfies GameTableStory,
        },
      });
    },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      const cell = await canvas.findByTestId(
        `custom-game-board-target-${target}`
      );
      await userEvent.click(cell);
      await userEvent.click(canvas.getByTestId('custom-game-board-fire'));
      await expect(cell).toHaveAccessibleName(outcome);
      await expect(cell).toHaveAttribute('aria-disabled', 'true');
      await userEvent.click(cell);
      await expect(cell).toHaveAccessibleName(outcome);
      if (wins)
        await expect(
          canvas.getByText('You win', { exact: true })
        ).toBeVisible();
      await expect(
        canvas.getByTestId('custom-game-board-target-e6')
      ).toHaveAccessibleName('E6: not fired at');
    },
  };
}

/** A miss stays visible and the player can no longer fire on Red's turn. */
export const FireAShot: Story = {
  ...shotJourney(VOLLEYS, 'e5', 'E5: miss, latest shot'),
};

export const HitAShip: Story = {
  ...shotJourney([], 'f10', 'F10: hit, latest shot'),
};

/** The second hit reveals the destroyer as sunk using the real shot resolver. */
export const SinkAShip: Story = {
  ...shotJourney(['f10', 'a2'], 'g10', 'G10: hit, sunk Destroyer, latest shot'),
};

/** The final shot reaches the result through the same resolver as all other shots. */
export const SinkTheFleet: Story = {
  ...shotJourney(
    BLUE_VICTORY.slice(0, -1),
    'g10',
    'G10: hit, sunk Destroyer, latest shot',
    true
  ),
};

export const CorrectTargetBeforeFiring: Story = {
  ...shotJourney([], 'j10', 'J10: miss, latest shot'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // regression: battleship-touch-spends-mistarget
    await assertTargetViewport(canvasElement, [
      canvas.getByTestId('custom-game-board-target-j10'),
      canvas.getByTestId('custom-game-board-fire'),
      canvas.getByTestId('custom-game-board-large-targets'),
    ]);
    await userEvent.click(
      canvas.getByTestId('custom-game-board-large-targets')
    );
    await userEvent.click(canvas.getByTestId('custom-game-board-region'));
    await userEvent.click(
      within(canvasElement.ownerDocument.body).getByTestId(
        'custom-game-board-area-3'
      )
    );
    await assertTargetWorkbench(canvasElement);
    const targetBounds = canvas
      .getByTestId('custom-game-board-target-j10')
      .getBoundingClientRect();
    await expect(targetBounds.width).toBeGreaterThanOrEqual(44);
    await expect(targetBounds.width).toBeLessThanOrEqual(64);
    await expect(targetBounds.height).toBeGreaterThanOrEqual(44);
    await userEvent.pointer([
      {
        keys: '[TouchA]',
        target: canvas.getByTestId('custom-game-board-target-j9'),
      },
    ]);
    await expect(
      canvas.getByTestId('custom-game-board-target-j9')
    ).toHaveAccessibleName('Fire at J9');
    await userEvent.pointer([
      {
        keys: '[TouchA]',
        target: canvas.getByTestId('custom-game-board-target-j10'),
      },
    ]);
    await expect(
      canvas.getByTestId('custom-game-board-fire')
    ).toHaveTextContent('Fire at J10');
    await assertTargetWorkbench(canvasElement, true);
    await userEvent.click(canvas.getByTestId('custom-game-board-cancel-aim'));
    await expect(canvas.getByTestId('custom-game-board-fire')).toBeDisabled();
    await userEvent.click(canvas.getByTestId('custom-game-board-target-j10'));
    await userEvent.click(canvas.getByTestId('custom-game-board-fire'));
    await expect(
      canvas.getByTestId('custom-game-board-target-j10')
    ).toHaveAccessibleName('J10: miss, latest shot');
  },
};
