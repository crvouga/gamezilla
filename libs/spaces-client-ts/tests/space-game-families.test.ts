import { describe, expect, test } from 'bun:test';
import type { SpaceGameClient } from '@libs/spaces-client-ts/games-registry-context';
import {
  soleMode,
  spaceGameFamilies,
} from '@libs/spaces-client-ts/space-game-families';
import { Handles } from '@libs/test-ids-shared-ts/handles';

function game(
  id: string,
  players: number,
  fields: Partial<SpaceGameClient> = {}
): SpaceGameClient {
  return {
    id,
    title: id,
    players,
    motif: 'trails',
    family: id,
    familyTitle: id,
    bots: false,
    MainMenu: () => null,
    ...fields,
  };
}

const mode = (id: string, players: number, bots = false): SpaceGameClient =>
  game(id, players, { family: 'race', familyTitle: 'Race', bots });

describe('spaceGameFamilies', () => {
  test('modes share one family, in order of first appearance', () => {
    const families = spaceGameFamilies([
      mode('race', 2),
      game('board', 2),
      mode('race-4', 4, true),
      mode('race-3', 3),
    ]);
    expect(families.map((family) => family.family)).toEqual(['race', 'board']);
    const [race, board] = families;
    expect(race?.title).toBe('Race');
    expect(race?.counts).toEqual([2, 3, 4]);
    expect(race?.bots).toBe(true);
    expect(race?.modes.map((each) => each.id)).toEqual([
      'race',
      'race-4',
      'race-3',
    ]);
    expect(race === undefined ? null : soleMode(race)).toBeNull();
    expect(board === undefined ? null : soleMode(board)?.id).toBe('board');
  });

  test('a game with no seat count is played alone', () => {
    const { players: _seats, ...unseated } = game('solo', 1);
    const [solo] = spaceGameFamilies([unseated]);
    expect(solo?.counts).toEqual([1]);
  });

  test("a mode's id begins with its family's, so its tile can be found", () => {
    expect(() =>
      spaceGameFamilies([mode('race', 2), mode('derby', 3)])
    ).toThrow(/derby: a mode of the race family/);
    expect(Handles.gameFamiliesOf('race-3')).toContain(
      Handles.gameFamily('race')
    );
  });

  test('every mode names its family alike and shares its tile', () => {
    expect(() =>
      spaceGameFamilies([
        mode('race', 2),
        { ...mode('race-3', 3), familyTitle: 'Other' },
      ])
    ).toThrow(/familyTitle/);
    expect(() =>
      spaceGameFamilies([
        mode('race', 2),
        { ...mode('race-3', 3), motif: 'cards' },
      ])
    ).toThrow(/tile/);
  });
});
