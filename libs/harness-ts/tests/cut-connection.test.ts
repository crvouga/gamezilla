import { describe, expect, test } from 'bun:test';
import { cutConnection } from '@libs/harness-ts/platform';
import { isHostLimit } from '@pkgs/gherkin-shared-ts/registry';
import { ActionNotEnabled } from '@pkgs/harness-root-shared-ts/probe';

/** A browser host: no virtual network, `partition` answered by `partition`. */
function browserWorld(partition: () => Promise<void>) {
  const applied: string[] = [];
  return {
    applied,
    world: {
      s: {
        read: () => Promise.resolve([] as string[]),
        apply: (action: { readonly name: string }, ...args: unknown[]) => {
          applied.push(`${action.name}(${args.join(', ')})`);
          return action.name === 'partition' ? partition() : Promise.resolve();
        },
      },
    },
  };
}

describe('cutConnection on a host without a virtual network', () => {
  // regression: browser-cut-connection-refused
  test('a browser device that goes offline is offline, not a failed step', async () => {
    const { world, applied } = browserWorld(() => Promise.resolve());
    await cutConnection(world as never, 'alice');
    expect(applied).toEqual(['partition(alice)']);
  });

  test('a host that refuses to go offline ends the scenario as a host limit', async () => {
    const { world } = browserWorld(() =>
      Promise.reject(new ActionNotEnabled('partition'))
    );
    const outcome = await cutConnection(world as never, 'alice').catch(
      (error: unknown) => error
    );
    expect(isHostLimit(outcome)).toBe(true);
  });
});
