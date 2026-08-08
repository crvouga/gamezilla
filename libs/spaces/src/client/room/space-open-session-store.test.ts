import { afterEach, describe, expect, it } from 'bun:test';

import {
  clearAllSpaceOpenSessions,
  clearSpaceOpenSession,
  getOrCreateSpaceClientId,
  readSpaceClientId,
} from './space-open-session-store';

afterEach(() => {
  clearAllSpaceOpenSessions();
});

describe('space-open-session-store', () => {
  it('reuses the same clientId for a space until the session is cleared', () => {
    const a = getOrCreateSpaceClientId('space-1');
    const b = getOrCreateSpaceClientId('space-1');
    expect(a).toBe(b);
    expect(readSpaceClientId('space-1')).toBe(a);

    clearSpaceOpenSession('space-1');
    expect(readSpaceClientId('space-1')).toBeNull();
    const c = getOrCreateSpaceClientId('space-1');
    expect(c).not.toBe(a);
  });

  it('keeps distinct clientIds per space', () => {
    const a = getOrCreateSpaceClientId('space-a');
    const b = getOrCreateSpaceClientId('space-b');
    expect(a).not.toBe(b);
  });
});
