import { describe, expect, test } from 'bun:test';
import { multiplayerNotices } from '@libs/game-matchmaking-shared/multiplayer-notices';

const PEOPLE = {
  white_id: 'alice',
  black_id: 'bob',
  setup_ready: null,
} as const;

function notices(
  outcome: 'ongoing' | 'white' | 'black' | 'draw' | 'aborted',
  turn: string,
  timeControl = '3d'
) {
  return multiplayerNotices({
    ...PEOPLE,
    outcome,
    turn,
    time_control: timeControl,
  }).map((person) => [person.userId, person.turn, person.result]);
}

describe('who has a turn notice and what each result notice says', () => {
  test('only the person to move in an unfinished daily game has a turn notice', () => {
    expect(notices('ongoing', 'alice')).toEqual([
      ['alice', true, null],
      ['bob', false, null],
    ]);
    expect(notices('ongoing', 'bob')).toEqual([
      ['alice', false, null],
      ['bob', true, null],
    ]);
  });

  test('a game that is over tells each person how it ended for them, and nobody to move', () => {
    expect(notices('white', '')).toEqual([
      ['alice', false, 'won'],
      ['bob', false, 'lost'],
    ]);
    expect(notices('black', '')).toEqual([
      ['alice', false, 'lost'],
      ['bob', false, 'won'],
    ]);
    expect(notices('draw', '')).toEqual([
      ['alice', false, 'drawn'],
      ['bob', false, 'drawn'],
    ]);
    expect(notices('aborted', '')).toEqual([
      ['alice', false, 'aborted'],
      ['bob', false, 'aborted'],
    ]);
  });

  test('each notice names the other person as the multiplayer opponent', () => {
    expect(
      multiplayerNotices({
        ...PEOPLE,
        outcome: 'ongoing',
        turn: 'alice',
        time_control: '1d',
      }).map((person) => person.opponentId)
    ).toEqual(['bob', 'alice']);
  });

  test('nobody has a turn notice while a private setup is still being chosen', () => {
    expect(
      multiplayerNotices({
        ...PEOPLE,
        setup_ready: 'black',
        outcome: 'ongoing',
        turn: 'alice',
        time_control: '3d',
      }).map((person) => person.turn)
    ).toEqual([false, false]);
    expect(
      multiplayerNotices({
        ...PEOPLE,
        setup_ready: 'white,black',
        outcome: 'ongoing',
        turn: 'alice',
        time_control: '3d',
      }).map((person) => person.turn)
    ).toEqual([true, false]);
  });

  test('a multiplayer game that is not a daily game brings none', () => {
    expect(notices('ongoing', 'alice', '5+0')).toEqual([]);
    expect(notices('white', '', '30+20')).toEqual([]);
  });
});
