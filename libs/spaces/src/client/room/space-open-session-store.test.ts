import { afterEach, describe, expect, it } from 'bun:test';
import { createSimIo } from '@pkgs/io';

import {
  clearAllSpaceOpenSessions,
  clearSpaceOpenSession,
  getOrCreateSpaceClientId,
  readSpaceClientId,
} from './space-open-session-store';

const io = createSimIo({ seed: 1 });

afterEach(() => {
  clearAllSpaceOpenSessions();
});

describe('space-open-session-store', () => {
  it('reuses the same clientId for a space until the session is cleared', () => {
    const a = getOrCreateSpaceClientId('space-1', io.createId);
    const b = getOrCreateSpaceClientId('space-1', io.createId);
    expect(a).toBe(b);
    expect(readSpaceClientId('space-1')).toBe(a);

    clearSpaceOpenSession('space-1');
    expect(readSpaceClientId('space-1')).toBeNull();
    const c = getOrCreateSpaceClientId('space-1', io.createId);
    expect(c).not.toBe(a);
  });

  it('keeps distinct clientIds per space', () => {
    const a = getOrCreateSpaceClientId('space-a', io.createId);
    const b = getOrCreateSpaceClientId('space-b', io.createId);
    expect(a).not.toBe(b);
  });
});
