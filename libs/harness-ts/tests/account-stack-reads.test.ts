import { expect, test } from 'bun:test';
import { returnToTabs } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { shownText } from '@libs/harness-ts/observations';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { createVirtualClock } from '@pkgs/harness-root-shared-ts/clock';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';
import { ElementNotFoundError } from '@pkgs/ui-testing-root-shared-ts/element-not-found-error';

const unused = (): never => {
  throw new Error('Unexpected gesture');
};

function scriptedUi(script: {
  readonly visible: (id: string) => boolean;
  readonly tap?: (id: string) => void;
  readonly text?: (id: string) => string;
}): Driver {
  return {
    kind: 'script',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: () => Promise.resolve(null),
    get: (id): DriverNode => ({
      get: unused,
      attribute: async () => null,
      tapAt: unused,
      drag: unused,
      layout: unused,
      selectFile: unused,
      input: unused,
      clear: unused,
      key: unused,
      scroll: unused,
      wait: unused,
      isVisible: async () => script.visible(id),
      text: async () => (script.text ?? unused)(id),
      tap: async () => (script.tap ?? unused)(id),
      expect: { visible: unused, hidden: unused, text: unused },
    }),
  };
}

function harnessWith(actorId: string, ui: Driver): ProductHarness {
  const clock = createVirtualClock();
  return {
    actors: new Map([[actorId, { ui }]]),
    session: {
      scheduler: { virtual: true, clock, starvedAdvances: () => 0 },
      advanceTime: (ms: number) => Promise.resolve(clock.advance(ms)),
      waitForIdle: () => Promise.resolve(),
    },
  } as unknown as ProductHarness;
}

// regression: return-to-tabs-compact-account-stack
test('a compact Account screen returns to the tabs through Settings', async () => {
  // Profile > Settings > Account: on a phone only Profile shows the tab bar.
  const stack = ['profile', 'settings', 'account'];
  const ui = scriptedUi({
    visible: (id) =>
      id === Handles.tabProfile
        ? stack.at(-1) === 'profile'
        : id === Handles.navBack && stack.length > 1,
    tap: (id) => {
      if (id !== Handles.navBack) throw new Error(`tap ${id}`);
      stack.pop();
    },
  });
  await Promise.resolve(
    returnToTabs.act(harnessWith('alice_phone', ui), 'alice_phone')
  );
  expect(stack).toEqual(['profile']);
});

// regression: deletion-modal-closes-between-reads
test('a dialog that closes between its reads has no text to show', async () => {
  const ui = scriptedUi({
    visible: (id) => id === 'privacy-delete-modal',
    text: (id) => {
      throw new ElementNotFoundError(`testId("${id}")`);
    },
  });
  expect(
    await shownText(harnessWith('alice', ui), 'alice', ['privacy-delete-modal'])
  ).toBeNull();
});
