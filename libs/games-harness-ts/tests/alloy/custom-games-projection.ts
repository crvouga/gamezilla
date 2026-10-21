import type { readStoredCustomGameWorld } from '@libs/game-session-harness-ts/custom-game-stored';
import type { Snapshot } from '@pkgs/alloy-shared-ts/world';

type Stored = Awaited<ReturnType<typeof readStoredCustomGameWorld>>;
const KIND = {
  person: 'PersonSide',
  bot: 'BotSide',
  invitation: 'InvitedSide',
  open: 'OpenSide',
  closed: 'ClosedSide',
} as const;
const STATUS = {
  configuring: 'SettingUp',
  active: 'UnderWay',
  completed: 'Finished',
  cancelled: 'Cancelled',
} as const;
/** The structure's field for each of the product's sides. */
const SIDE_FIELD = { white: 'firstSide', black: 'secondSide' } as const;

/** Rename atoms only; every membership, side and status comes from the stores. */
export function projectCustomGames(stored: Stored, label: string): Snapshot {
  const games = [
    ...stored.games.history,
    ...(stored.games.current === null ? [] : [stored.games.current]),
  ];
  const people = new Set([
    ...stored.members,
    ...(stored.host === null ? [] : [stored.host]),
  ]);
  const relations: Record<string, string[][]> = {
    'Space.spaceHost': stored.host === null ? [] : [['space', stored.host]],
    'Space.peopleInSpace': stored.members.map((person) => ['space', person]),
    'Space.current':
      stored.games.current === null ? [] : [['space', stored.games.current.id]],
    'CustomGame.space': [],
    'CustomGame.creator': [],
    'CustomGame.firstSide': [],
    'CustomGame.secondSide': [],
    'CustomGame.status': [],
    'CustomGame.ready': [],
    'CustomGame.started': [],
    'Side.kind': [],
    'Side.person': [],
  };
  const add = (field: string, ...tuple: string[]) =>
    relations[field]?.push(tuple);
  for (const game of games) {
    people.add(game.creator);
    add('CustomGame.space', game.id, 'space');
    add('CustomGame.creator', game.id, game.creator);
    add('CustomGame.status', game.id, STATUS[game.status]);
    if (game.startedAt !== null) add('CustomGame.started', game.id, game.id);
    for (const side of ['white', 'black'] as const) {
      const id = `${game.id}-${SIDE_FIELD[side]}`;
      add(`CustomGame.${SIDE_FIELD[side]}`, game.id, id);
      add('Side.kind', id, KIND[game[side].kind]);
      if (game[side].person !== '') {
        people.add(game[side].person);
        add('Side.person', id, game[side].person);
      }
      if (game.ready.includes(side)) add('CustomGame.ready', game.id, id);
    }
  }
  return {
    label,
    atoms: {
      Person: [...people],
      Space: ['space'],
      CustomGame: games.map((game) => game.id),
      Side: games.flatMap((game) => [
        `${game.id}-firstSide`,
        `${game.id}-secondSide`,
      ]),
      ...Object.fromEntries(
        [...Object.values(KIND), ...Object.values(STATUS)].map((name) => [
          name,
          [name],
        ])
      ),
    },
    relations,
  };
}
