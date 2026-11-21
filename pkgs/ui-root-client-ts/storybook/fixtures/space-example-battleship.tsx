/** @jsxImportSource solid-js */

import {
  BattleshipTargetHeader,
  BattleshipWholeBoard,
} from '@pkgs/ui-root-client-ts/battleship-target-layout';
import {
  CellGridBoard,
  type CellGridCell,
  CellGridLegend,
  type CellGridLegendItem,
} from '@pkgs/ui-root-client-ts/cell-grid-board';
import type {
  SpaceGame,
  SpaceGameAction,
  SpaceGameSeat,
  SpacePerson,
} from '@pkgs/ui-root-client-ts/space-types';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';

/**
 * Which moment of one fixed mid-game the fixture shows: the viewer's shot
 * with C4 aimed, or the rival's shot while the viewer waits.
 */
export type SpaceExampleBattleshipMoment = 'aimed' | 'theirShot';

export type SpaceExampleBattleshipOptions = {
  /** Defaults to `aimed`. */
  moment?: SpaceExampleBattleshipMoment | undefined;
  /** Every action and aim lands here (`data-action` id or cell id). */
  onAction?: ((id: string) => void) | undefined;
};

const COLUMNS = 'ABCDEFGHIJ'.split('');
const ROWS = Array.from({ length: 10 }, (_, index) => String(index + 1));
const AIMED = 'C4';
const RIVAL = 'bob';

type Mark = 'ship' | 'miss' | 'hit' | 'sunk';

/** What the viewer knows of bob's waters: two ships sunk, one hit. */
const TARGET_MARKS: Readonly<Record<string, Mark>> = {
  A1: 'miss',
  F2: 'miss',
  H7: 'miss',
  D9: 'miss',
  J5: 'miss',
  B5: 'sunk',
  B6: 'sunk',
  G2: 'sunk',
  G3: 'sunk',
  G4: 'sunk',
  E7: 'hit',
};

/** The viewer's own fleet with bob's shots on it: one ship sunk. */
const OWN_MARKS: Readonly<Record<string, Mark>> = {
  A2: 'ship',
  B2: 'ship',
  C2: 'ship',
  D2: 'hit',
  E2: 'ship',
  H1: 'ship',
  H2: 'ship',
  H3: 'ship',
  H4: 'ship',
  C6: 'ship',
  D6: 'ship',
  E6: 'ship',
  J7: 'ship',
  J8: 'ship',
  J9: 'ship',
  A9: 'sunk',
  B9: 'sunk',
  A5: 'miss',
  F5: 'miss',
};

const LOOK: Readonly<
  Record<Mark, Pick<CellGridCell, 'glyph' | 'tone' | 'outlined'>>
> = {
  ship: { glyph: '■', tone: 'occupied' },
  miss: { glyph: '•', tone: 'quiet' },
  hit: { glyph: '✕', tone: 'alert' },
  sunk: { glyph: '✖', tone: 'critical', outlined: true },
};

const WORD: Readonly<Record<Mark, string>> = {
  ship: 'your ship',
  miss: 'miss',
  hit: 'hit',
  sunk: 'sunk',
};

const SHOT_KEY: readonly CellGridLegendItem[] = [
  { glyph: '•', tone: 'quiet', label: 'Miss' },
  { glyph: '✕', tone: 'alert', label: 'Hit' },
  { glyph: '✖', tone: 'critical', outlined: true, label: 'Sunk' },
];

/** Ships still afloat in this fixed position, out of five each. */
const AFLOAT = { you: 4, rival: 3 } as const;

function cellIds(): readonly string[] {
  return ROWS.flatMap((row) => COLUMNS.map((column) => `${column}${row}`));
}

function targetCell(
  id: string,
  moment: SpaceExampleBattleshipMoment
): CellGridCell {
  const mark = TARGET_MARKS[id];
  if (mark !== undefined) {
    return { id, ...LOOK[mark], label: `${id}: ${WORD[mark]}`, enabled: false };
  }
  const aimed = moment === 'aimed' && id === AIMED;
  return {
    id,
    glyph: aimed ? '◎' : '',
    tone: 'open',
    emphasis: aimed ? 'pending' : 'none',
    label: aimed ? `${id}: aimed` : `${id}: untried water`,
    enabled: moment === 'aimed',
  };
}

function ownCell(id: string): CellGridCell {
  const mark = OWN_MARKS[id];
  if (mark === undefined) {
    return {
      id,
      glyph: '',
      tone: 'open',
      label: `${id}: open water`,
      enabled: false,
    };
  }
  return { id, ...LOOK[mark], label: `${id}: ${WORD[mark]}`, enabled: false };
}

function Waters(props: {
  heading: string;
  testId: string;
  cells: readonly CellGridCell[];
  legend: readonly CellGridLegendItem[];
  onActivate?: ((id: string) => void) | undefined;
}): JSX.Element {
  return (
    <StackVertical gap="xs" align="center" width="full">
      <BattleshipTargetHeader>
        <P variant="caption">{props.heading}</P>
        <CellGridLegend label="Key" items={props.legend} />
      </BattleshipTargetHeader>
      <BattleshipWholeBoard>
        <CellGridBoard
          fill
          label={props.heading}
          testId={props.testId}
          columnLabels={COLUMNS}
          rowLabels={ROWS}
          cells={props.cells}
          onActivate={props.onActivate}
        />
      </BattleshipWholeBoard>
    </StackVertical>
  );
}

/** Both grids: bob's waters to aim at above, the viewer's fleet below. */
function BattleshipSpaceBoard(props: {
  moment: SpaceExampleBattleshipMoment;
  onAim: (id: string) => void;
}): JSX.Element {
  const ids = cellIds();
  return (
    <StackVertical gap="lg" width="full">
      <Waters
        heading={`${RIVAL}'s waters`}
        testId="space-battleship-target"
        cells={ids.map((id) => targetCell(id, props.moment))}
        legend={SHOT_KEY}
        onActivate={props.moment === 'aimed' ? props.onAim : undefined}
      />
      <Waters
        heading="Your fleet"
        testId="space-battleship-own"
        cells={ids.map(ownCell)}
        legend={[{ glyph: '■', tone: 'occupied', label: 'Ship' }, ...SHOT_KEY]}
      />
    </StackVertical>
  );
}

function surrender(press: (id: string) => void): SpaceGameAction {
  return {
    id: 'surrender',
    label: 'Surrender',
    tone: 'destructive',
    onPress: () => press('surrender'),
  };
}

function seat(
  person: SpacePerson,
  moment: SpaceExampleBattleshipMoment
): SpaceGameSeat {
  const you = person.you === true;
  const afloat = you ? AFLOAT.you : AFLOAT.rival;
  return {
    color: you ? 'player1' : 'player2',
    turn: you === (moment === 'aimed'),
    data: {
      value: `${afloat} ships`,
      description: `${afloat} ships afloat`,
    },
  };
}

/**
 * Battleship as a `SpaceGame`: two players, hidden fleets, two grids. One
 * fixed mid-game position, deterministic and timer-free; every press is
 * reported through `onAction` and changes nothing.
 */
export function spaceExampleBattleship(
  options?: SpaceExampleBattleshipOptions
): SpaceGame {
  const moment = options?.moment ?? 'aimed';
  const press = (id: string): void => options?.onAction?.(id);
  const aimed = moment === 'aimed';
  return {
    key: 'battleship',
    name: 'Battleship',
    motif: 'fleet',
    tagline: 'Sink the hidden fleet',
    players: { counts: [2], bots: false },
    setup: {
      settings: [
        {
          kind: 'choice',
          label: 'Mode',
          options: [{ value: 'classic', label: 'Classic' }],
          value: 'classic',
          onChange: () => press('mode'),
        },
        {
          kind: 'choice',
          label: 'Fleet',
          options: [{ value: 'five', label: '5 ships each' }],
          value: 'five',
          onChange: () => press('fleet'),
        },
      ],
    },
    play: {
      status: aimed ? `Aiming at ${AIMED}` : `${RIVAL}'s shot`,
      detail: 'Battleship · shot 17',
      board: <BattleshipSpaceBoard moment={moment} onAim={press} />,
      actions: aimed
        ? [
            surrender(press),
            {
              id: 'fire',
              label: `Fire at ${AIMED}`,
              emphasis: 'primary',
              onPress: () => press('fire'),
            },
          ]
        : [],
      waiting: aimed ? undefined : `${RIVAL} is taking his shot`,
      seat: (person) => seat(person, moment),
      personActions: (person) =>
        person.you === true ? [surrender(press)] : [],
    },
  };
}
