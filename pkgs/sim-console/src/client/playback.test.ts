import { describe, expect, test } from 'bun:test';

import { playbackToggleAction } from './playback';

describe('playbackToggleAction', () => {
  test('pauses when already playing', () => {
    expect(playbackToggleAction({ playing: true, atEnd: false })).toBe('pause');
    expect(playbackToggleAction({ playing: true, atEnd: true })).toBe('pause');
  });

  test('restarts when idle on the last frame', () => {
    expect(playbackToggleAction({ playing: false, atEnd: true })).toBe(
      'restart'
    );
  });

  test('plays from the current frame when not at the end', () => {
    expect(playbackToggleAction({ playing: false, atEnd: false })).toBe('play');
  });
});
