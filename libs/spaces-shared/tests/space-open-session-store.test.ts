import { describe, expect, it } from 'bun:test';
import { SpaceOpenSessionStore } from '@libs/spaces-shared/space-open-session-store';
import { createHarnessAdapters } from '@pkgs/uuid-shared/harness-adapters';

const adapters = createHarnessAdapters({ seed: 1 });

describe('space-open-session-store', () => {
  it('reuses the same clientId for a space until the session is cleared', () => {
    const store = new SpaceOpenSessionStore(adapters.createId);
    const a = store.getOrCreate('space-1', 'install-a');
    const b = store.getOrCreate('space-1', 'install-a');
    expect(a).toBe(b);
    expect(store.read('space-1', 'install-a')).toBe(a);

    store.clear('space-1', 'install-a');
    expect(store.read('space-1', 'install-a')).toBeNull();
    const c = store.getOrCreate('space-1', 'install-a');
    expect(c).not.toBe(a);
  });

  it('keeps distinct clientIds per space', () => {
    const store = new SpaceOpenSessionStore(adapters.createId);
    const a = store.getOrCreate('space-a', 'install-a');
    const b = store.getOrCreate('space-b', 'install-a');
    expect(a).not.toBe(b);
  });

  it('isolates clientIds across install ids (product-harness multi-actor)', () => {
    const store = new SpaceOpenSessionStore(adapters.createId);
    const alice = store.getOrCreate('space-1', 'alice-device');
    const bob = store.getOrCreate('space-1', 'bob-device');
    expect(alice).not.toBe(bob);
  });
});
