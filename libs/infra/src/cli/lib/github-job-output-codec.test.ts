import { expect, test } from 'bun:test';

import {
  decodeGithubJobOutputValue,
  encodeGithubJobOutputValue,
} from './github-job-output-codec';

test('encode/decode round-trips lock ids and urls', () => {
  const samples = [
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'https://api.gamezilla.app',
    'https://www.gamezilla.app',
  ];
  for (const sample of samples) {
    expect(decodeGithubJobOutputValue(encodeGithubJobOutputValue(sample))).toBe(
      sample
    );
  }
});

test('decode accepts plain legacy values', () => {
  expect(decodeGithubJobOutputValue('plain-lock-id')).toBe('plain-lock-id');
  expect(decodeGithubJobOutputValue('')).toBe('');
});

test('encoded form does not contain the plaintext secret substring', () => {
  const apiUrl = 'https://api.gamezilla.app';
  const encoded = encodeGithubJobOutputValue(apiUrl);
  expect(encoded.includes(apiUrl)).toBe(false);
  expect(encoded.includes('api.gamezilla.app')).toBe(false);
});
