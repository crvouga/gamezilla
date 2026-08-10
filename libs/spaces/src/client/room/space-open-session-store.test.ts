import { afterEach, describe, expect, it } from 'bun:test';
import { createSimIo } from '@pkgs/io';

import {
  clearAllSpaceOpenSessions,
  clearSpaceOpenSession,
  readSpaceClientId,
  SpaceOpenSessionStore,
} from './space-open-session-store';

const io = createSimIo({ seed: 1 });

afterEach(() => {
  clearAllSpaceOpenSessions();
});

describe('space-open-session-store', () => {
  it('reuses the same clientId for a space until the session is cleared', () => {
    const a = new SpaceOpenSessionStore(io.createId).getOrCreate('space-1');
    const b = new SpaceOpenSessionStore(io.createId).getOrCreate('space-1');
    expect(a).toBe(b);
    expect(readSpaceClientId('space-1')).toBe(a);

    clearSpaceOpenSession('space-1');
    expect(readSpaceClientId('space-1')).toBeNull();
    const c = new SpaceOpenSessionStore(io.createId).getOrCreate('space-1');
    expect(c).not.toBe(a);
  });

  it('keeps distinct clientIds per space', () => {
    const a = new SpaceOpenSessionStore(io.createId).getOrCreate('space-a');
    const b = new SpaceOpenSessionStore(io.createId).getOrCreate('space-b');
    expect(a).not.toBe(b);
  });
});
