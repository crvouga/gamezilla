import { describe, expect, test } from 'bun:test';

import { containsLink, linkCheck } from '@pkgs/moderation-shared/link-check';
import {
  censorObscenity,
  obscenityCheck,
} from '@pkgs/moderation-shared/obscenity-check';
import { unicodeSafetyCheck } from '@pkgs/moderation-shared/unicode-safety-check';

describe('obscenityCheck', () => {
  const check = obscenityCheck({ id: 'o', version: 1 });

  test('flags disguised profanity', () => {
    expect(check.inspect('sh1thead_99')).toEqual({ code: 'profanity' });
    expect(check.inspect('fuuuck')).toEqual({ code: 'profanity' });
  });

  test('keeps innocent words that contain a profane substring', () => {
    expect(check.inspect('Scunthorpe')).toBeNull();
    expect(check.inspect('assassin')).toBeNull();
    expect(check.inspect('Friday puzzles')).toBeNull();
  });

  test('censors only the offending span', () => {
    expect(censorObscenity('hello shit world')).toMatch(/^hello \S{4} world$/);
    expect(censorObscenity('hello world')).toBe('hello world');
  });
});

describe('unicodeSafetyCheck', () => {
  const check = unicodeSafetyCheck({ id: 'u', version: 1 });

  test('refuses text that hides or reorders what it says', () => {
    expect(check.inspect('abc‮def')).toEqual({ code: 'bidi_control' });
    expect(check.inspect('fu​ck')).toEqual({
      code: 'invisible_character',
    });
    expect(check.inspect('a\u0007b')).toEqual({ code: 'control_character' });
    expect(check.inspect('ź̂̃')).toEqual({
      code: 'mark_stack',
    });
  });

  test('accepts accented and non-Latin text', () => {
    expect(check.inspect('Café crème')).toBeNull();
    expect(check.inspect('チェス好き')).toBeNull();
    expect(check.inspect('Tiếng Việt')).toBeNull();
  });
});

describe('linkCheck', () => {
  test('refuses links, domains and emails', () => {
    for (const text of [
      'https://spam.example',
      'go to www . spam',
      'free-coins.gg',
      'chat (dot) ru',
      'me@mail.com',
    ]) {
      expect(containsLink(text)).toBe(true);
    }
    expect(linkCheck({ id: 'l', version: 1 }).inspect('x.com')).toEqual({
      code: 'link',
    });
  });

  test('accepts ordinary titles', () => {
    for (const text of ['Friday puzzles', 'Chess club 2.0', 'Mr. Bean']) {
      expect(containsLink(text)).toBe(false);
    }
  });
});
