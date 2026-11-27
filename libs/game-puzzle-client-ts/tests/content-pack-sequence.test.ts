import { expect, test } from 'bun:test';
import { isNumberedSequence } from '@libs/game-puzzle-client-ts/content-pack-sequence';

test('titles that number their own place are a sequence', () => {
  expect(isNumberedSequence(['Dock 01', 'Dock 02', 'Dock 03'])).toBe(true);
  expect(isNumberedSequence(['First threads 1', 'First threads 2'])).toBe(true);
  expect(isNumberedSequence(['1', '2', '3'])).toBe(true);
  expect(isNumberedSequence(['Level 1'])).toBe(true);
});

test('named puzzles are no sequence: they need their names', () => {
  expect(isNumberedSequence(['Count to five', 'Count to seven'])).toBe(false);
  expect(isNumberedSequence(['Count to 5', 'Count to 7'])).toBe(false);
});

test('a number that skips, repeats or starts elsewhere is no sequence', () => {
  expect(isNumberedSequence(['Dock 01', 'Dock 03'])).toBe(false);
  expect(isNumberedSequence(['Dock 01', 'Dock 01'])).toBe(false);
  expect(isNumberedSequence(['Dock 02', 'Dock 03'])).toBe(false);
});

test('an empty pack is no sequence', () => {
  expect(isNumberedSequence([])).toBe(false);
});

test('a number inside a word is not a place', () => {
  expect(isNumberedSequence(['Room4'])).toBe(false);
});
