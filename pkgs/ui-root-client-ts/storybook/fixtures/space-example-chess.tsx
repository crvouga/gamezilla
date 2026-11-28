import { createSignal } from 'solid-js';
import type { GameOptionFieldProps } from '../../src/game-option-field/index';
import type { GameSeatLook } from '../../src/game-seat-swatch/index';
import type {
  SpaceGame,
  SpacePerson,
  SpacePersonData,
} from '../../src/space-types';

/** A chess side. */
export type SpaceExampleChessSide = 'White' | 'Black';

/**
 * Sides by story person id, never by the `you` / `host` flags (the stories
 * flip those when the viewer is the host): bob, the host, plays White; the
 * guest, `you` (named ana), plays Black.
 */
const SIDE_OF_ID: Readonly<Record<string, SpaceExampleChessSide>> = {
  bob: 'White',
  you: 'Black',
};

/** The side a person plays in the Chess example; none for anyone else. */
export function spaceExampleChessSide(
  person: SpacePerson
): SpaceExampleChessSide | undefined {
  return SIDE_OF_ID[person.id];
}

/** A side drawn as its king, kept as a text glyph (never an emoji). */
export function spaceExampleChessSideLook(
  side: SpaceExampleChessSide
): GameSeatLook {
  return { mark: side === 'White' ? '♔︎' : '♚︎' };
}

const CLOCK_MINUTES: Readonly<Record<string, number>> = {
  '5': 5,
  '10': 10,
  '30': 30,
};

/**
 * Chess as a space's game while it is set up: two players, no bots, a mode
 * and a clock; each person's data line is their side and their clock.
 */
export function spaceExampleChessSetup(): SpaceGame {
  const [mode, setMode] = createSignal('custom');
  const [clock, setClock] = createSignal('10');
  const minutes = (): number => CLOCK_MINUTES[clock()] ?? 10;
  const settings: readonly GameOptionFieldProps[] = [
    {
      kind: 'choice',
      label: 'Mode',
      options: [
        { value: 'custom', label: 'Game session' },
        { value: 'rated', label: 'Rated game' },
      ],
      get value() {
        return mode();
      },
      onChange: setMode,
      testId: 'space-chess-mode',
    },
    {
      kind: 'choice',
      label: 'Clock',
      options: [
        { value: '5', label: '5 min each' },
        { value: '10', label: '10 min each' },
        { value: '30', label: '30 min each' },
      ],
      get value() {
        return clock();
      },
      onChange: setClock,
      testId: 'space-chess-clock',
    },
  ];
  const personData = (person: SpacePerson): SpacePersonData | undefined => {
    const side = spaceExampleChessSide(person);
    if (side === undefined) {
      return undefined;
    }
    return {
      swatch: spaceExampleChessSideLook(side),
      value: `${minutes()}:00`,
      description: `playing ${side}, ${minutes()} minutes on the clock`,
    };
  };
  return {
    key: 'chess',
    name: 'Chess',
    motif: 'checkered',
    tagline: 'Two players, one board',
    players: { counts: [2], bots: false },
    setup: { settings, personData },
  };
}
