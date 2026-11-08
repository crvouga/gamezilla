import {
  BOARD_CONTROLS_EXCLUDE,
  boardArgs,
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import {
  initialPongState,
  type PongState,
  parsePongInput,
} from '@libs/pong-shared-ts/pong-state';
import { createPongStep } from '@libs/pong-shared-ts/pong-step';
import { boardOnly } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSimulationControls } from '@pkgs/turn-game-shared-ts/game-presentation';
import {
  type GameSide,
  TWO_PLAYER_SIDES,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { createSignal } from 'solid-js';
import { expect, fireEvent, fn, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PongBoardView } from './pong-board-view';
import { pongGameClient } from './pong-game-client';
import { PongJourney } from './pong-journey.example';

/**
 * A game to three points played for `ticks` with nobody moving a paddle:
 * the ball is served, and every rally ends at the left paddle's side.
 */
function court(ticks: number): string {
  const config = pongConfig({ targetScore: 3 });
  const step = createPongStep(config);
  let state: PongState = initialPongState(config, () => 0);
  for (let tick = 1; tick <= ticks; tick++)
    state = step(state, [], {
      tick,
      deltaMs: 1000 / config.tickRate,
      elapsedMs: (tick * 1000) / config.tickRate,
      random: () => 0.3,
    });
  return pongPositionCodec.encode(state);
}

/** The controls of a person playing `sides` from this device. */
function playing(
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

/** Pong's own presentation, its board the view (no sounds in a story). */
const presentation = {
  ...pongGameClient.presentation,
  frame: {
    ...pongGameClient.presentation.frame,
    createBoard: boardOnly(PongBoardView),
  },
};

const meta = {
  id: 'screens-games-pong-court',
  title: 'Screens/Games/Pong/Court',
  component: PongBoardView,
  tags: ['autodocs'],
  render: (args, context) =>
    renderGameTable(presentation, TWO_PLAYER_SIDES, args, context),
  parameters: {
    appRouter: true,
    controls: { exclude: [...BOARD_CONTROLS_EXCLUDE] },
    // Played in real time: no turns, so the record lists no moves.
    table: { turns: false } satisfies GameTableStory,
  },
  args: boardArgs(court(220), { simulation: playing(['white']) }),
} satisfies Meta<typeof PongBoardView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Before the first serve: the court counts down. */
export const Countdown: Story = {
  args: { position: court(0) },
  play: courtFeedbackGeometry,
};

/** A rally under way: the person moves the left paddle by keys, drag or slider. */
export const Rally: Story = {};

/** Right has scored; the next serve counts down with the new score. */
export const ServeAfterPoint: Story = { args: { position: court(300) } };

/** Right leads by two, one point from the win. */
export const MatchPoint: Story = { args: { position: court(440) } };

/** A player is away: play pauses and the controls wait. */
export const Paused: Story = {
  args: { simulation: playing(['white'], { paused: true }) },
  play: courtFeedbackGeometry,
};

/** The connection dropped: the controls resume when the game returns. */
export const Reconnecting: Story = {
  args: { simulation: playing(['white'], { stale: true }) },
  play: courtFeedbackGeometry,
};

/** Two people on one device: a slider for each paddle. */
export const TwoPlayersOnOneDevice: Story = {
  args: { simulation: playing(['white', 'black']) },
  play: courtFeedbackGeometry,
};

/** A watcher sees the court and no controls. */
export const Watching: Story = {
  args: { simulation: undefined },
  parameters: { table: { viewer: null } },
};

/** Right reached three points: the court says who won and the controls stop. */
export const Finished: Story = {
  args: { position: court(543), simulation: playing(['white']) },
  parameters: {
    table: {
      ending: { winner: 'black', reason: 'score target' },
    } satisfies GameTableStory,
  },
};

/** A position this app cannot read says so, with the way back. */
export const Unreadable: Story = {
  args: { position: 'pong:not-a-position', simulation: undefined },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', {
      name: 'Back to spaces',
    });
    const bounds = link.getBoundingClientRect();
    await expect(bounds.top).toBeGreaterThanOrEqual(0);
    await expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
    await expect(bounds.height).toBeGreaterThanOrEqual(44);
    await expect(link).toHaveAttribute('href', '/');
  },
};

/** Keyboard input advances the real fixed-step mechanics and repaints the paddle. */
export const PaddleMovement: Story = {
  render: (args, context) => {
    const config = pongConfig();
    const step = createPongStep(config);
    const [state, setState] = createSignal(initialPongState(config, () => 0));
    let tick = 0;
    const simulation = playing(args.simulation?.sides ?? ['white'], {
      onInput: (side, value) => {
        const input = parsePongInput(value);
        if (!input) throw new Error('Invalid paddle input');
        tick += 1;
        setState(
          step(
            state(),
            [
              {
                tick,
                sequence: tick,
                playerId: side === 'white' ? 'left' : 'right',
                value: input,
              },
            ],
            {
              tick,
              deltaMs: 1000 / config.tickRate,
              elapsedMs: (tick * 1000) / config.tickRate,
              random: () => 0,
            }
          )
        );
      },
    });
    return renderGameTable(
      presentation,
      TWO_PLAYER_SIDES,
      {
        ...args,
        simulation,
        get position() {
          return pongPositionCodec.encode(state());
        },
      },
      context
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const court = canvas.getByRole('application', { name: 'Pong court' });
    const paddle = canvasElement.querySelector('rect[data-controlled="true"]');
    if (!paddle) throw new Error('Missing controlled paddle');
    const before = Number(paddle.getAttribute('y'));
    const key = paddle.getAttribute('data-side') === 'first' ? 'w' : 'ArrowUp';
    await fireEvent.keyDown(court, { key });
    await expect(
      Number(
        canvasElement
          .querySelector('rect[data-controlled="true"]')
          ?.getAttribute('y')
      )
    ).toBeLessThan(before);
    await fireEvent.keyUp(court, { key });
  },
};

/** The same production mechanics with the right paddle controlled. */
export const RightPaddleMovement: Story = {
  ...PaddleMovement,
  args: { simulation: playing(['black']) },
};

/** Both paddles update independently for native simultaneous touch evidence. */
export const SharedPaddleMovement: Story = {
  ...PaddleMovement,
  args: { simulation: playing(['white', 'black']) },
};

/** Return, interruption, restored input and a point, all using real fixed-step rules. */
export const ReturnScoreAndReconnect: Story = {
  render: (args, context) => (
    <PongJourney>
      {(position, simulation) =>
        renderGameTable(
          presentation,
          TWO_PLAYER_SIDES,
          {
            ...args,
            simulation,
            get position() {
              return position();
            },
          },
          context
        )
      }
    </PongJourney>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const court = canvas.getByRole('application', { name: 'Pong court' });
    const paddle = () =>
      canvasElement.querySelector(
        'rect[data-side="first"][data-controlled="true"]'
      );
    const y = () => Number(paddle()?.getAttribute('y'));
    const before = y();
    await fireEvent.keyDown(court, { key: 'ArrowUp' });
    await fireEvent.keyUp(court, { key: 'ArrowUp' });
    await expect(y()).toBeLessThan(before);
    await expect(canvas.getByTestId('pong-journey-returns')).toHaveTextContent(
      '1 returns'
    );
    await fireEvent.click(canvas.getByRole('button', { name: /^Disconnect$/ }));
    const stopped = y();
    await fireEvent.keyDown(court, { key: 'ArrowDown' });
    await expect(y()).toBe(stopped);
    await expect(court).toHaveAttribute('data-interactive', 'false');
    await fireEvent.click(
      canvas.getByRole('button', { name: 'Restore connection' })
    );
    await expect(court).toHaveAttribute('data-interactive', 'true');
    await fireEvent.keyDown(court, { key: 'ArrowDown' });
    await fireEvent.keyUp(court, { key: 'ArrowDown' });
    await expect(y()).toBeGreaterThan(stopped);
    await fireEvent.click(
      canvas.getByRole('button', { name: 'Advance three seconds' })
    );
    await expect(canvas.getByTestId('pong-journey-points')).toHaveTextContent(
      '1 points'
    );
    await expect(
      canvas.getByText('Left 1', { exact: true })
    ).toBeInTheDocument();
  },
};

/** Read native geometry before any interaction can scroll a target into view. */
async function courtFeedbackGeometry({
  canvasElement,
}: {
  canvasElement: HTMLElement;
}) {
  const court = within(canvasElement).getByRole('application');
  const bounds = court.getBoundingClientRect();
  await expect(bounds.top).toBeGreaterThanOrEqual(0);
  await expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
  const cues = court.querySelectorAll(
    '[role="status"], [data-testid$="-gesture"]'
  );
  for (const cue of cues) {
    const rect = cue.getBoundingClientRect();
    await expect(rect.width).toBeGreaterThan(0);
    await expect(rect.left).toBeGreaterThanOrEqual(bounds.left);
    await expect(rect.right).toBeLessThanOrEqual(bounds.right);
    await expect(rect.top).toBeGreaterThanOrEqual(bounds.top);
    await expect(rect.bottom).toBeLessThanOrEqual(bounds.bottom);
  }
}
