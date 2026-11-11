/**
 * The Synthetic Population panel rereads on a timer; without a connection a
 * reread fails, and the panel must keep what it last read rather than drop
 * every Synthetic User's control panel for an error.
 */
import { expect, test } from 'bun:test';
import { lastKnownValue } from '@libs/synthetic-population-client-ts/resource-value';
import { createResource, createRoot } from 'solid-js';

test('a failed reread keeps the last value read', async () => {
  let online = true;
  let reads = 0;
  await createRoot(async (dispose) => {
    const [panel, { refetch }] = createResource(async () => {
      reads += 1;
      if (!online) throw new Error('offline');
      return { users: ['Cedar', 'Maple'], read: reads };
    });
    const known = lastKnownValue(panel);
    await Promise.resolve(refetch());
    expect(known()).toEqual({ users: ['Cedar', 'Maple'], read: reads });

    online = false;
    await Promise.resolve(refetch()).catch(() => undefined);
    expect(panel.error).toBeDefined();
    expect(known()?.users).toEqual(['Cedar', 'Maple']);
    dispose();
  });
});

test('before any read succeeds there is nothing to keep', async () => {
  await createRoot(async (dispose) => {
    const [panel, { refetch }] = createResource(async (): Promise<string> => {
      throw new Error('offline');
    });
    const known = lastKnownValue(panel);
    await Promise.resolve(refetch()).catch(() => undefined);
    expect(panel.error).toBeDefined();
    expect(known()).toBeUndefined();
    dispose();
  });
});
