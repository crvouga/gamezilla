import { expect, test } from 'bun:test';
import { BATTLESHIP_HARNESS_GAME } from '@libs/battleship-harness/battleship-harness-game';
import { readBattleshipRecord } from '@libs/battleship-harness/battleship-record-reading';

const { fixtures, shared } = BATTLESHIP_HARNESS_GAME;
const rules = shared.turnGame.rules;

/** The position after the first `ply` known shots, each answered with the known fleets. */
function after(ply: number): string {
  const setup = rules.setup;
  const setups = fixtures.setups;
  if (setup === undefined || setups === undefined)
    throw new Error('Battleship has private fleets');
  let position = rules.initial();
  for (const proposal of fixtures.firstSideVictory.slice(0, ply)) {
    const action = setup.resolve(position, proposal, setups);
    const played =
      action === null ? null : rules.play(position, action, '', []);
    if (played === null) throw new Error(`${proposal} was refused`);
    position = played.position;
  }
  return position;
}

test('the known victory sinks the second fleet with the seventeenth hit, on the thirty-third shot', () => {
  const won = after(33);
  expect(fixtures.firstSideVictory).toHaveLength(33);
  expect(fixtures.firstSideVictoryLabels.at(-1)).toBe(
    'G10 sinks the destroyer'
  );
  expect(rules.legal(won)).toEqual([]);
  expect(rules.legal(after(32))).not.toEqual([]);
});

test('a Battleship record reads back its people, result, clock choice and shots', () => {
  const position = after(33);
  const history = shared.turnGame.capabilities.history;
  if (history === undefined) throw new Error('Battleship offers history');
  const record = history.record(position, '', {
    participants: [
      { name: 'alice', rating: null },
      { name: 'bob', rating: null },
    ],
    outcome: 'white',
    reason: 'fleet sunk',
    timeControl: { minutes: 5, incrementSeconds: 0, daysPerMove: 0 },
  });
  expect(readBattleshipRecord(record)).toEqual({
    firstSide: 'alice',
    secondSide: 'bob',
    result: 'white',
    clockChoice: '5+0',
    moves: fixtures.firstSideVictoryLabels,
  });
});
