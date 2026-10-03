import { describe, expect, test } from 'bun:test';
import { validateGoalGate } from '../goal/goal-manifest';

const bindingPath = 'libs/chess/tests/quint/custom-game-play.binding.ts';
const fixturePath = 'libs/chess/tests/quint/fixtures/partition.itf.json';
const binding = `
import { bindQuintModel } from '@pkgs/quint/registry';
import trace from './fixtures/partition.itf.json';
bindQuintModel<World>({
  model: 'custom-game-play',
  regressions: [
    // regression: partition-spends-time
    { id: 'partition-spends-time', title: 'Offline picture', seed: '0x67932', itf: trace },
  ],
  actions: { init: setup, _loseConnection: partition },
  observe: read,
});`;
const history = JSON.stringify({
  vars: ['ply', 'mbt::actionTaken', 'mbt::nondetPicks'],
  states: [
    { ply: 0, 'mbt::actionTaken': 'init', 'mbt::nondetPicks': {} },
    {
      ply: 0,
      'mbt::actionTaken': '_loseConnection',
      'mbt::nondetPicks': { actor: { tag: 'Some', value: 'bob' } },
    },
  ],
});

function gate(source: string, fixture: string | null = history) {
  const proofs = new Map<string, string>([[bindingPath, source]]);
  if (fixture !== null) proofs.set(fixturePath, fixture);
  return validateGoalGate({
    knownBugs: [
      {
        id: 'partition-spends-time',
        summary: 'Partition must retain the last picture at the same instant.',
        regressionTest: bindingPath,
      },
    ],
    proofFiles: { owns: () => true, read: (path) => proofs.get(path) ?? null },
  });
}

describe('canonical Quint regression proof', () => {
  test('a registered literal history guards the concrete failing input', () => {
    // regression: known-bug-gate-rejects-pinned-quint
    expect(gate(binding)).toEqual([]);
  });
  test('a marker alone is not a registered regression', () => {
    expect(gate('// regression: partition-spends-time')).not.toEqual([]);
  });
  test('a seed without the literal ITF input cannot guard a regression', () => {
    expect(gate(binding.replace('itf: trace', 'seedOnly: trace'))).not.toEqual(
      []
    );
  });
  test('an unrelated registration cannot satisfy the bug marker', () => {
    expect(
      gate(binding.replace("id: 'partition-spends-time'", "id: 'other-bug'"))
    ).not.toEqual([]);
  });
  test('commented registration cannot satisfy the marker', () => {
    expect(gate(`/* ${binding} */`)).not.toEqual([]);
  });
  test('missing or malformed fixtures fail the proof', () => {
    expect(gate(binding, null)).not.toEqual([]);
    expect(gate(binding, '{broken')).not.toEqual([]);
  });
  test('an empty history or init alone does not pin the failing action', () => {
    expect(
      gate(binding, JSON.stringify({ vars: ['mbt::actionTaken'], states: [] }))
    ).not.toEqual([]);
    expect(
      gate(
        binding,
        JSON.stringify({
          vars: ['mbt::actionTaken'],
          states: [{ 'mbt::actionTaken': 'init' }],
        })
      )
    ).not.toEqual([]);
  });
  test('a history must begin with init and replay registered actions', () => {
    expect(
      gate(binding, history.replace('"init"', '"_loseConnection"'))
    ).not.toEqual([]);
    expect(
      gate(binding, history.replace('"_loseConnection"', '"unregistered"'))
    ).not.toEqual([]);
  });
  test('an imported generated trace is not a pinned JSON fixture', () => {
    expect(
      gate(binding.replace('partition.itf.json', 'partition.ts'))
    ).not.toEqual([]);
  });
  test('a literal regression still requires its own marker', () => {
    expect(
      gate(binding.replace('// regression: partition-spends-time', ''))
    ).not.toEqual([]);
  });
  test('a string containing the marker is not the required comment', () => {
    expect(
      gate(
        binding.replace(
          '// regression: partition-spends-time',
          "title: '// regression: partition-spends-time',"
        )
      )
    ).not.toEqual([]);
  });
  test('repeated init does not pin an action that exposed the bug', () => {
    expect(
      gate(binding, history.replace('"_loseConnection"', '"init"'))
    ).not.toEqual([]);
  });
});
