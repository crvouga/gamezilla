/** @jsxImportSource solid-js */
/**
 * The global menu's membership chip: nothing until a feature publishes, the
 * published label once it does, and gone again when it withdraws.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { GlobalMenuIdentityRoot } from '@libs/client-app/chrome/global-menu-identity-context';
import { GlobalMenuMembershipChip } from '@libs/client-app/chrome/global-menu-membership-chip';
import {
  type GlobalMenuMembership,
  useGlobalMenuMembership,
  useGlobalMenuMembershipPublisher,
} from '@libs/client-app/chrome/global-menu-membership-context';
import { Handles } from '@libs/test-ids';
import { ThemeProvider } from '@pkgs/ui';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { type JSX, Show } from 'solid-js';

afterEach(cleanup);

type Publish = (membership: GlobalMenuMembership | null) => void;

/** Renders the chip the way the menu header does, and hands out the publisher. */
function mount(): Publish {
  let publish: Publish = () => undefined;
  function Probe(): JSX.Element {
    publish = useGlobalMenuMembershipPublisher();
    const membership = useGlobalMenuMembership();
    return (
      <Show when={membership()} keyed>
        {(current) => <GlobalMenuMembershipChip membership={current} />}
      </Show>
    );
  }
  render(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 800, height: 600 }}
    >
      <GlobalMenuIdentityRoot>
        <Probe />
      </GlobalMenuIdentityRoot>
    </ThemeProvider>
  ));
  return (membership) => publish(membership);
}

function chip(): HTMLElement | null {
  return screen.queryByTestId(Handles.globalMenuMembership);
}

describe('global menu membership chip', () => {
  test('shows nothing until a feature publishes a tier', () => {
    mount();
    expect(chip()).toBeNull();
  });

  for (const membership of [
    { label: 'Guest', highlighted: false },
    { label: 'Free', highlighted: false },
    { label: 'Plus', highlighted: true },
  ] as const) {
    test(`shows the ${membership.label} tier`, () => {
      const publish = mount();
      publish(membership);
      expect(chip()?.textContent).toBe(membership.label);
    });
  }

  test('a paying member is drawn in a different tone from the rest', () => {
    const publish = mount();
    publish({ label: 'Free', highlighted: false });
    const plain = chip()?.getAttribute('style');
    publish({ label: 'Plus', highlighted: true });
    expect(chip()?.getAttribute('style')).not.toBe(plain);
  });

  test('withdrawing the tier removes the chip', () => {
    const publish = mount();
    publish({ label: 'Plus', highlighted: true });
    publish(null);
    expect(chip()).toBeNull();
  });
});
