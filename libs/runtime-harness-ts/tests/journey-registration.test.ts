import { expect, test } from 'bun:test';
import '@libs/harness-ts/define';
import '@libs/runtime-harness-ts/journeys.steps';
import { matchStep } from '@pkgs/gherkin-shared-ts/registry';

test('shared journey discovery preserves existing families and registers every bot start', () => {
  const examples = [
    'they start a custom game against a bot',
    'Alice and Bob play Connect Four from fresh devices',
    'White and Black open with e4 and e5 in multiplayer chess',
    'Alice authors, playtests and publishes a Numberlink pack from a fresh device',
    'Alice authors and playtests a Sokoban puzzle from a fresh device',
    'Alice and Bob play Pong from fresh devices',
  ];
  for (const game of [
    'Hearts',
    'Word Tiles',
    'Word Tiles for three',
    'Word Tiles for four',
    'Light Cycles Duel',
    'Light Cycles Trio',
    'Light Cycles Quad',
  ]) {
    examples.push(`Alice starts "${game}" with bots from a fresh device`);
    examples.push(`Alice sees "${game}" under way against bots`);
  }
  for (const example of examples) expect(matchStep(example).kind).toBe('match');
});
