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
    const a = new SpaceOpenSessionStore(io.createId).getOrCreate(
      'space-1',
      'install-a'
    );
    const b = new SpaceOpenSessionStore(io.createId).getOrCreate(
      'space-1',
      'install-a'
    );
    expect(a).toBe(b);
    expect(readSpaceClientId('space-1', 'install-a')).toBe(a);

    clearSpaceOpenSession('space-1', 'install-a');
    expect(readSpaceClientId('space-1', 'install-a')).toBeNull();
    const c = new SpaceOpenSessionStore(io.createId).getOrCreate(
      'space-1',
      'install-a'
    );
    expect(c).not.toBe(a);
  });

  it('keeps distinct clientIds per space', () => {
    const a = new SpaceOpenSessionStore(io.createId).getOrCreate(
      'space-a',
      'install-a'
    );
    const b = new SpaceOpenSessionStore(io.createId).getOrCreate(
      'space-b',
      'install-a'
    );
    expect(a).not.toBe(b);
  });

  it('isolates clientIds across install ids (playground multi-actor)', () => {
    const alice = new SpaceOpenSessionStore(io.createId).getOrCreate(
      'space-1',
      'alice-device'
    );
    const bob = new SpaceOpenSessionStore(io.createId).getOrCreate(
      'space-1',
      'bob-device'
    );
    expect(alice).not.toBe(bob);
  });
});
