/**
 * Hosting a space ends leftover live spaces first. A free account hosts one,
 * and the production monitor account is reused across runs.
 */
import { describe, expect, test } from 'bun:test';
import { hostSpace } from '@libs/runtime/harness/critical-journeys';
import { Handles } from '@libs/test-ids';
import type {
  Driver,
  DriverNode,
  DriverWaitOptions,
  WaitState,
  WaitTextCondition,
} from '@pkgs/ui-testing';

const HOST = 'OldMink726';

type Screen = 'spaces' | 'profile' | 'join' | 'in-space' | 'ended';

type World = {
  screen: Screen;
  spacesLeft: number;
  /** The hosted-space list has heard from the server. */
  listReady: boolean;
  confirm: boolean;
  dismiss: boolean;
  created: boolean;
  readonly taps: string[];
};

function visible(world: World, id: string): boolean {
  const onTabs = world.screen === 'spaces' || world.screen === 'profile';
  // The shell header stays up on pushed screens, including Join and Ended.
  if (id === Handles.statusCurrentUser) return true;
  if (id === Handles.tabSpaces || id === Handles.tabProfile) return onTabs;
  if (id === Handles.spaceCreate) return world.screen === 'spaces';
  if (id === Handles.spacesListReady) {
    return world.screen === 'spaces' && world.listReady;
  }
  if (id === Handles.spacesHostingCount) {
    return world.screen === 'spaces' && world.listReady && world.spacesLeft > 0;
  }
  if (id === Handles.spaceCard(HOST)) {
    return world.screen === 'spaces' && world.listReady && world.spacesLeft > 0;
  }
  if (id === Handles.profileDisplayUsername) return world.screen === 'profile';
  if (id === Handles.spaceJoin) return world.screen === 'join';
  if (id === Handles.spaceEnd) return world.screen === 'in-space';
  if (id === Handles.spaceEndConfirm) return world.confirm;
  if (id === Handles.spaceMutationDismiss) return world.dismiss;
  if (id === Handles.spaceEnded) return world.screen === 'ended';
  if (id === Handles.spaceClose) return world.created;
  if (id === Handles.navBack) {
    return (
      world.screen === 'join' ||
      world.screen === 'in-space' ||
      world.screen === 'ended'
    );
  }
  return false;
}

function applyTap(world: World, id: string): void {
  world.taps.push(id);
  if (id === Handles.tabProfile) world.screen = 'profile';
  else if (id === Handles.tabSpaces || id === Handles.navBack) {
    world.screen = 'spaces';
    world.confirm = false;
  } else if (id === Handles.spaceCard(HOST)) world.screen = 'join';
  else if (id === Handles.spaceJoin) world.screen = 'in-space';
  else if (id === Handles.spaceEnd) world.confirm = true;
  else if (id === Handles.spaceEndConfirm) {
    world.confirm = false;
    world.dismiss = true;
  } else if (id === Handles.spaceMutationDismiss) {
    world.dismiss = false;
    world.spacesLeft -= 1;
    world.screen = 'ended';
  } else if (id === Handles.spaceCreate) world.created = true;
}

function node(world: World, id: string): DriverNode {
  const shown = (): boolean => visible(world, id);
  const assertState = (state: WaitState | WaitTextCondition): void => {
    if (typeof state === 'object') return;
    if (state === 'visible' && !shown()) {
      throw new Error(`${id} is not visible`);
    }
    if (state === 'hidden' && shown()) throw new Error(`${id} is visible`);
  };
  const self: DriverNode = {
    get: (child) => node(world, child),
    tap: async () => {
      assertState('visible');
      applyTap(world, id);
    },
    tapAt: () => Promise.reject(new Error('unused')),
    drag: () => Promise.reject(new Error('unused')),
    layout: () => Promise.resolve(null),
    input: () => Promise.reject(new Error('unused')),
    clear: () => Promise.reject(new Error('unused')),
    key: () => Promise.reject(new Error('unused')),
    scroll: () => Promise.reject(new Error('unused')),
    wait: (
      state: WaitState | WaitTextCondition,
      _options?: DriverWaitOptions
    ) => {
      assertState(state);
      return Promise.resolve();
    },
    expect: {
      visible: () => {
        // Waiting for the list is what settles it, the way sync does.
        if (id === Handles.spacesListReady) world.listReady = true;
        assertState('visible');
        return Promise.resolve();
      },
      hidden: () => {
        assertState('hidden');
        return Promise.resolve();
      },
      text: () => Promise.resolve(),
    },
    isVisible: () => Promise.resolve(shown()),
    text: () =>
      Promise.resolve(
        id === Handles.profileDisplayUsername ? `@${HOST}` : null
      ),
  };
  return self;
}

function driver(
  spacesLeft: number,
  listReady = true
): {
  readonly ui: Driver;
  readonly world: World;
} {
  const world: World = {
    screen: 'spaces',
    spacesLeft,
    listReady,
    confirm: false,
    dismiss: false,
    created: false,
    taps: [],
  };
  const ui: Driver = {
    kind: 'script',
    launch: () => Promise.resolve(),
    close: () => Promise.resolve(),
    get: (id) => node(world, id),
    key: () => Promise.reject(new Error('unused')),
    snapshotHtml: () => Promise.resolve(null),
  };
  return { ui, world };
}

function expectJoinedThenEnded(
  taps: readonly string[],
  leftovers: number
): void {
  const joins = taps.filter((id) => id === Handles.spaceJoin);
  const ends = taps.filter((id) => id === Handles.spaceEndConfirm);
  expect(joins).toEqual(
    Array.from({ length: leftovers }, () => Handles.spaceJoin)
  );
  expect(ends).toEqual(
    Array.from({ length: leftovers }, () => Handles.spaceEndConfirm)
  );
  expect(taps.indexOf(Handles.spaceJoin)).toBeLessThan(
    taps.indexOf(Handles.spaceEndConfirm)
  );
  expect(taps.lastIndexOf(Handles.spaceJoin)).toBeLessThan(
    taps.lastIndexOf(Handles.spaceEndConfirm)
  );
  expect(taps.lastIndexOf(Handles.spaceCreate)).toBeGreaterThan(
    taps.lastIndexOf(Handles.spaceEndConfirm)
  );
}

describe('hostSpace', () => {
  // regression: journey-host-blocked-by-leftover-spaces
  // regression: journey-leftover-opens-on-join
  test('ends leftover live spaces before opening a new one', async () => {
    const { ui, world } = driver(2);
    await hostSpace(ui);
    expectJoinedThenEnded(world.taps, 2);
    expect(world.spacesLeft).toBe(0);
    expect(world.created).toBe(true);
  });

  test('opens a space directly when the person hosts none', async () => {
    const { ui, world } = driver(0);
    await hostSpace(ui);
    expect(world.taps).toContain(Handles.spaceCreate);
    expect(world.taps).not.toContain(Handles.spaceEnd);
    expect(world.taps).not.toContain(Handles.spaceJoin);
    expect(world.created).toBe(true);
  });

  // regression: journey-leftovers-hidden-until-spaces-sync
  test('ends leftovers that appear only once the list has synced', async () => {
    const { ui, world } = driver(1, false);
    await hostSpace(ui);
    expectJoinedThenEnded(world.taps, 1);
    expect(world.spacesLeft).toBe(0);
    expect(world.created).toBe(true);
  });
});
