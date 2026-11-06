import {
  BOARD_CONTROLS_EXCLUDE,
  boardArgs,
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import {
  LIGHT_CYCLES_SEATS,
  lightCyclesConfig,
} from '@libs/light-cycles-shared-ts/light-cycles-config';
import { lightCyclesPositionCodec } from '@libs/light-cycles-shared-ts/light-cycles-position';
import {
  initialLightCyclesState,
  type LightCyclesState,
} from '@libs/light-cycles-shared-ts/light-cycles-state';
import { createLightCyclesStep } from '@libs/light-cycles-shared-ts/light-cycles-step';
import { boardOnly } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSimulationControls } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { LightCyclesBoardView } from './light-cycles-board-view';
import {
  lightCyclesDuelClient,
  lightCyclesQuadClient,
  lightCyclesTrioClient,
} from './light-cycles-game-client';
import {
  createLightCyclesJourney,
  type LightCyclesJourney,
} from './light-cycles-journey.example';
import { sharedSwipe } from './light-cycles-swipe.example';

const TRIO = LIGHT_CYCLES_SEATS[3];
const codec = lightCyclesPositionCodec(3);

/**
 * A three-rider round played for `ticks` with nobody steering (each rider
 * rides straight from its spawn), first to `targetScore` round wins.
 */
function trio(ticks: number, targetScore = 3): string {
  const config = lightCyclesConfig({ targetScore });
  const step = createLightCyclesStep(config);
  let state: LightCyclesState = initialLightCyclesState(config, TRIO);
  for (let tick = 1; tick <= ticks; tick++)
    state = step(state, [], {
      tick,
      deltaMs: 1000 / config.tickRate,
      elapsedMs: (tick * 1000) / config.tickRate,
      random: () => 0,
    });
  return codec.encode(state);
}

/** The controls of a person riding `sides` from this device. */
function riding(
  sides: readonly GameSide[],
  overrides: Partial<GameSimulationControls> = {}
): GameSimulationControls {
  return {
    paused: false,
    stale: false,
    sides,
    onInput: fn(),
    onRelease: fn(),
    ...overrides,
  };
}

/** The countdown before the first round: riders on their spawns. */
const COUNTDOWN = trio(0);
/** Every rider riding straight across the arena. */
const RUNNING = trio(120);
/** Nova has crashed into a trail; Comet and Ember still ride. */
const CRASHED = trio(140);
/** Ember outlasted the others and takes the round. */
const ROUND_OVER = trio(153);
/** The same round, first to one round win, ends the game. */
const COMPLETED = trio(153, 1);

/** The trio's own presentation, its board the view (no sounds in a story). */
const presentation = {
  ...lightCyclesTrioClient.presentation,
  frame: {
    ...lightCyclesTrioClient.presentation.frame,
    createBoard: boardOnly(LightCyclesBoardView),
  },
};

const meta = {
  id: 'screens-games-light-cycles-arena',
  title: 'Screens/Games/Light Cycles/Arena',
  component: LightCyclesBoardView,
  tags: ['autodocs'],
  render: (args, context) => renderGameTable(presentation, TRIO, args, context),
  parameters: {
    appRouter: true,
    controls: { exclude: [...BOARD_CONTROLS_EXCLUDE] },
    // Played in real time: no turns, so the record lists no moves.
    table: { turns: false } satisfies GameTableStory,
  },
  args: boardArgs(RUNNING, { simulation: riding(['white']) }),
} satisfies Meta<typeof LightCyclesBoardView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Before the round: the count down, and a turn chosen now applies on the first step. */
export const Countdown: Story = { args: { position: COUNTDOWN } };

/** The round under way: the person steers Comet with keys, swipes or the pad. */
export const Riding: Story = {};

/** The person's rider has crashed: they watch until the next round. */
export const Crashed: Story = {
  args: { position: CRASHED, orientation: 'red', simulation: riding(['red']) },
  play: playerBounds,
};

/** The round's winner shows over the arena until the next round starts. */
export const RoundOver: Story = {
  args: { position: ROUND_OVER },
  play: playerBounds,
};

/** The game is won: nobody steers, and the result shows. */
export const Finished: Story = {
  args: { position: COMPLETED, simulation: undefined },
  parameters: {
    table: {
      ending: { winner: 'black', reason: 'target score' },
    } satisfies GameTableStory,
  },
};

/** The connection dropped: steering waits for the game to return. */
export const Reconnecting: Story = {
  args: { simulation: riding(['white'], { stale: true }) },
  play: unavailableGuidance,
};

/** The person rides from another of their devices and may take it over here. */
export const RidingElsewhere: Story = {
  args: {
    simulation: riding([], { elsewhere: ['white'], claim: fn() }),
  },
};

/** A watcher sees the arena and no pads. */
export const Watching: Story = {
  args: { simulation: undefined },
  parameters: { table: { viewer: null } },
  play: unavailableGuidance,
};

/** Two riders on one device: one pad each. */
export const TwoRidersOnOneDevice: Story = {
  args: { simulation: riding(['white', 'black']) },
};

/** A position this app cannot read says so, with the way back. */
export const Unreadable: Story = {
  args: { position: 'light-cycles-3:not-a-position', simulation: undefined },
};

/** Inputs advance the real deterministic simulation and repaint the production board. */
function interactiveRender(
  count: 2 | 3 | 4,
  sides: readonly GameSide[],
  ready?: (journey: LightCyclesJourney) => void
) {
  return ((args, context) => {
    const journey = createLightCyclesJourney(count);
    ready?.(journey);
    const seats = LIGHT_CYCLES_SEATS[count];
    const simulation: GameSimulationControls = {
      ...riding(sides),
      get stale() {
        return journey.stale();
      },
      onInput: journey.onInput,
    };
    const client =
      count === 2
        ? lightCyclesDuelClient
        : count === 4
          ? lightCyclesQuadClient
          : lightCyclesTrioClient;
    const view = {
      ...client.presentation,
      frame: {
        ...client.presentation.frame,
        createBoard: boardOnly(LightCyclesBoardView),
      },
    };
    return renderGameTable(
      view,
      seats,
      {
        ...args,
        get position() {
          return lightCyclesPositionCodec(count).encode(journey.state());
        },
        simulation,
      },
      context
    );
  }) satisfies NonNullable<Story['render']>;
}

// regression: light-cycles-desktop-steer-up
export const SteerUp: Story = {
  render: interactiveRender(3, ['white']),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const arena = canvas.getByTestId('custom-game-board-arena');
    const rider = canvas.getByTestId('custom-game-board-arena-rider-0');
    const y = Number(rider.getAttribute('data-y'));
    await userEvent.click(arena);
    await userEvent.keyboard('{ArrowUp}');
    await expect(rider).toHaveAttribute('data-heading', 'up');
    await expect(rider).toHaveAttribute('data-y', String(y - 1));
  },
};

export const DuelSteering: Story = {
  ...SteerUp,
  render: interactiveRender(2, ['white']),
};
export const QuadSteering: Story = {
  ...SteerUp,
  render: interactiveRender(4, ['white']),
};

export const SharedKeyboard: Story = {
  render: interactiveRender(3, ['white', 'black']),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('custom-game-board-arena'));
    await userEvent.keyboard('{ArrowUp}w');
    await expect(
      canvas.getByTestId('custom-game-board-arena-rider-0')
    ).toHaveAttribute('data-heading', 'up');
    await expect(
      canvas.getByTestId('custom-game-board-arena-rider-1')
    ).toHaveAttribute('data-heading', 'up');
  },
};

// regression: light-cycles-player-facts-overflow
async function playerBounds({ canvasElement }: { canvasElement: HTMLElement }) {
  const cards = canvasElement.querySelectorAll(
    '[data-component="GamePlayerChip"], [data-component="GamePlayerBar"]'
  );
  await expect(cards.length).toBeGreaterThan(0);
  for (const card of cards) {
    const bounds = card.getBoundingClientRect();
    for (const child of card.querySelectorAll('span')) {
      const rect = child.getBoundingClientRect();
      if (rect.width === 0) continue;
      await expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
      await expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
    }
  }
}

// regression: light-cycles-inactive-steering-guidance
async function unavailableGuidance({
  canvasElement,
}: {
  canvasElement: HTMLElement;
}) {
  const canvas = within(canvasElement);
  await expect(
    canvas.queryByText(/Swipe the arena|Steer with the arrow keys/)
  ).not.toBeInTheDocument();
  await expect(canvas.getByTestId('custom-game-board-arena')).toHaveAttribute(
    'data-interactive',
    'false'
  );
}

function collisionJourney(): Story {
  let journey: LightCyclesJourney;
  return {
    render: interactiveRender(3, ['red'], (value) => {
      journey = value;
    }),
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      const rider = canvas.getByTestId('custom-game-board-arena-rider-2');
      const before = Number(rider.getAttribute('data-y'));
      await expect(rider).toHaveAttribute('data-alive', 'true');
      await userEvent.click(canvas.getByTestId('custom-game-board-arena'));
      await userEvent.keyboard('{ArrowDown}');
      await expect(rider).toHaveAttribute('data-y', String(before + 1));
      journey.advance(17);
      await expect(
        canvas.getByTestId('custom-game-board-status')
      ).toHaveAttribute('data-steering', 'crashed');
      await expect(
        canvas.getByTestId('custom-game-board-arena-rider-2')
      ).toHaveAttribute('data-alive', 'false');
      await expect(
        canvas.queryByTestId('custom-game-board-red-pad-up')
      ).not.toBeInTheDocument();
      journey.advance(13);
      await expect(
        canvas.getByTestId('custom-game-board-round')
      ).toHaveAttribute('data-phase', 'round-over');
      await expect(
        canvas.getByTestId('custom-game-board-result')
      ).toHaveTextContent('Ember wins the round');
      await expect(
        canvas.getByTestId('custom-game-board-arena-overlay')
      ).toHaveAttribute('data-open', 'false');
      journey.advance(60);
      await expect(
        canvas.getByTestId('custom-game-board-round')
      ).toHaveAttribute('data-round', '2');
      await expect(
        canvas.getByTestId('custom-game-board-arena-rider-2')
      ).toHaveAttribute('data-alive', 'true');
      await expect(
        canvas.getByTestId('custom-game-board-arena')
      ).toHaveAttribute('data-interactive', 'true');
    },
  };
}
// regression: light-cycles-crash-pad-and-obscured-result
export const CollisionThroughNextRound = collisionJourney();

function recoveryJourney(): Story {
  let journey: LightCyclesJourney;
  return {
    render: interactiveRender(3, ['white'], (value) => {
      journey = value;
      journey.setStale(true);
    }),
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      const arena = canvas.getByTestId('custom-game-board-arena');
      const rider = canvas.getByTestId('custom-game-board-arena-rider-0');
      const before = rider.getAttribute('data-y');
      await userEvent.click(arena);
      await userEvent.keyboard('{ArrowUp}');
      await expect(rider).toHaveAttribute('data-y', before);
      await expect(arena).toHaveAttribute('data-interactive', 'false');
      journey.setStale(false);
      await expect(arena).toHaveAttribute('data-interactive', 'true');
      await userEvent.click(arena);
      await userEvent.keyboard('{ArrowUp}');
      await expect(rider).toHaveAttribute('data-heading', 'up');
      await expect(rider).toHaveAttribute('data-y', String(Number(before) - 1));
    },
  };
}
export const ResumedSteering = recoveryJourney();

// regression: light-cycles-shared-device-guidance
export const SharedSwipe: Story = {
  render: interactiveRender(3, ['white', 'black']),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const left = canvas.queryByTestId('custom-game-board-black-pad');
    const right = canvas.queryByTestId('custom-game-board-white-pad');
    if (left && right) {
      // regression: light-cycles-pad-swipe-spatial-mismatch
      await expect(left.getBoundingClientRect().right).toBeLessThanOrEqual(
        right.getBoundingClientRect().left
      );
    }
    await sharedSwipe(canvasElement);
  },
};
