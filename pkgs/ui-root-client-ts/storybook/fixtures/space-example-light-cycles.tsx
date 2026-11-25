import type { JSX } from '@solidjs/web';
import { createSignal } from 'solid-js';
import type { AvatarSeatColor } from '../../src/avatar/index';
import type { GameOptionFieldProps } from '../../src/game-option-field/index';
import type { GameSeatColor } from '../../src/game-seat-swatch/index';
import type {
  SpaceGame,
  SpaceGameAction,
  SpaceGamePlay,
  SpacePerson,
  SpaceRole,
} from '../../src/space-types';
import { TrailArena } from '../../src/trail-arena/index';
import { VisuallyHidden } from '../../src/visually-hidden/index';
import { paintCells, rider } from './trail-arena-example-data';

export type SpaceExampleLightCyclesMoment = 'riding' | 'betweenRounds';

export type SpaceExampleLightCyclesOptions = {
  /** Who is looking: the host is `bob`, a guest is `you` (ana). */
  role?: SpaceRole | undefined;
  /** Defaults to `riding`. */
  moment?: SpaceExampleLightCyclesMoment | undefined;
  /** Every action lands here by its id. */
  onAction?: ((id: string) => void) | undefined;
};

/** Riders by story person id: bob rides first, ana second. */
const RIDER_OF_ID: Readonly<Record<string, 0 | 1>> = { bob: 0, you: 1 };
const TRAIL: readonly GameSeatColor[] = ['trail-one', 'trail-two'];
const PLAYER: readonly AvatarSeatColor[] = ['player1', 'player2'];
const WINS: Readonly<Record<string, number>> = { bob: 1, you: 2 };

function settings(
  role: SpaceRole,
  press: (id: string) => void
): readonly GameOptionFieldProps[] {
  const [mode, setMode] = createSignal('duel');
  const [riders, setRiders] = createSignal(2);
  return [
    {
      kind: 'choice',
      label: 'Mode',
      options: [
        { value: 'duel', label: 'Duel' },
        { value: 'arena', label: 'Free for all' },
      ],
      get value() {
        return mode();
      },
      onChange: (value) => {
        setMode(value);
        press(`mode-${value}`);
      },
      readOnly: role === 'guest',
    },
    {
      kind: 'count',
      label: 'Riders',
      get value() {
        return riders();
      },
      min: 2,
      max: 4,
      onChange: (value) => {
        setRiders(value);
        press(`riders-${String(value)}`);
      },
      message: { text: 'From 2 to 4 · no bots' },
    },
  ];
}

function Arena(props: { viewer: 0 | 1; riding: boolean }): JSX.Element {
  const id = 'space-light-cycles-help';
  return (
    <>
      <VisuallyHidden id={id}>
        {'Steer with the arrow keys or swipe on the arena.'}
      </VisuallyHidden>
      <TrailArena
        width={40}
        height={28}
        cells={paintCells(['4,22 4,10 14,10 14,6', '35,5 35,18 24,18 24,22'])}
        riders={[
          rider(0, [14, 5], 'up', {
            controlSlot: props.viewer === 0 ? 0 : null,
          }),
          rider(1, [23, 22], 'left', {
            controlSlot: props.viewer === 1 ? 0 : null,
          }),
        ]}
        crashes={[]}
        enabled={props.riding}
        heads="large"
        label="Light Cycles arena"
        instructionsId={id}
        testId="space-light-cycles-arena"
        onDirection={() => undefined}
      />
    </>
  );
}

function play(
  role: SpaceRole,
  moment: SpaceExampleLightCyclesMoment,
  press: (id: string) => void
): SpaceGamePlay {
  const riding = moment === 'riding';
  const action = (id: string, label: string): SpaceGameAction => ({
    id,
    label,
    onPress: () => press(id),
  });
  return {
    status: riding ? 'Round 4' : 'ana takes round 3',
    detail: 'Light Cycles · Duel',
    get board() {
      return <Arena viewer={role === 'host' ? 0 : 1} riding={riding} />;
    },
    actions: riding
      ? [action('turn-left', 'Turn left'), action('turn-right', 'Turn right')]
      : [],
    waiting: 'Next round starts in a moment',
    seat: (person: SpacePerson) => {
      const index = RIDER_OF_ID[person.id];
      if (index === undefined) return undefined;
      const wins = WINS[person.id] ?? 0;
      return {
        color: PLAYER[index],
        turn: riding,
        data: {
          value: wins === 1 ? '1 win' : `${String(wins)} wins`,
          description: `${String(wins)} rounds won`,
        },
      };
    },
  };
}

/** Light Cycles as a `SpaceGame`: 2 to 4 riders, modes, no bots. */
export function spaceExampleLightCycles(
  options: SpaceExampleLightCyclesOptions = {}
): SpaceGame {
  const role = options.role ?? 'guest';
  const press = (id: string): void => options.onAction?.(id);
  return {
    key: 'light-cycles',
    name: 'Light Cycles',
    motif: 'trails',
    tagline: 'Riders race in one arena of light trails',
    players: { counts: [2, 3, 4], bots: false },
    setup: {
      settings: settings(role, press),
      personData: (person) => {
        const index = RIDER_OF_ID[person.id];
        if (index === undefined) return undefined;
        return {
          swatch: { color: TRAIL[index] ?? 'trail-one' },
          value: `P${String(index + 1)}`,
          description: `rider ${String(index + 1)}`,
        };
      },
    },
    play: play(role, options.moment ?? 'riding', press),
  };
}
