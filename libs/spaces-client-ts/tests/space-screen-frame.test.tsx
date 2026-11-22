/** @jsxImportSource solid-js */
/** Every screen in a space sits in the space's own rows, loading included. */

import { afterEach, expect, test } from 'bun:test';
import {
  type SpaceDetailStatus,
  type SpaceScreenChromeValue,
  SpaceScreenChromeValueProvider,
} from '@libs/spaces-client-ts/space-screen-chrome';
import { SpaceScreenFrame } from '@libs/spaces-client-ts/space-screen-frame';
import { ClaimSpaceShell } from '@libs/spaces-client-ts/space-shell-claim';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

afterEach(cleanup);

const noop = (): void => {};

function chrome(status: SpaceDetailStatus): SpaceScreenChromeValue {
  return {
    spaceId: 'space-1',
    spaceName: 'Friday game night',
    role: 'guest',
    hostName: 'avery',
    people: [{ id: 'me', kind: 'person', name: 'sam', you: true }],
    hostOffline: false,
    status,
    onBack: noop,
    backLabel: undefined,
    menu: [{ id: 'minimize', label: 'Minimize space', onPress: noop }],
    onLeave: noop,
    onEnd: noop,
    onInvite: undefined,
    onPersonAction: noop,
    personCapabilities: [],
    testIds: {
      back: Handles.spaceBackToSpaces,
      title: Handles.spaceTitle,
      settings: Handles.spaceChromeOverflow,
      leave: Handles.spaceLeave,
      end: Handles.spaceEnd,
    },
  };
}

function renderFrame(status: SpaceDetailStatus, screen: () => JSX.Element) {
  const time = createHarnessClock();
  return renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 800 }}
      >
        <SpaceScreenChromeValueProvider value={chrome(status)}>
          <SpaceScreenFrame>{screen()}</SpaceScreenFrame>
        </SpaceScreenChromeValueProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
}

function byTestId(container: HTMLElement, id: string): Element | null {
  return container.querySelector(`[data-testid="${id}"]`);
}

// regression: space-root-no-way-out
test('at the space’s root back leads to Spaces and says so, over the screen', () => {
  const { container } = renderFrame('ready', () => (
    <StackVertical testId="games">{null}</StackVertical>
  ));
  const back = byTestId(container, Handles.spaceBackToSpaces);
  expect(back?.getAttribute('aria-label')).toBe('Back to spaces');
  expect(byTestId(container, Handles.spaceTitle)?.textContent).toBe(
    'Friday game night'
  );
  const stage = container.querySelector('[data-space-row="stage"]');
  expect(stage?.contains(byTestId(container, 'games'))).toBe(true);
});

test('while the space is reached the stage loads under the space’s rows', () => {
  const { container } = renderFrame('loading', () => (
    <StackVertical testId="games">{null}</StackVertical>
  ));
  const stage = container.querySelector('[data-space-row="stage"]');
  expect(stage?.contains(byTestId(container, Handles.spaceLoading))).toBe(true);
  expect(byTestId(container, Handles.spaceChromeOverflow)).not.toBeNull();
  expect(byTestId(container, 'games')).toBeNull();
});

test('a screen that draws its own shell is rendered bare, once', () => {
  const { container } = renderFrame('ready', () => (
    <>
      <ClaimSpaceShell />
      <StackVertical testId="own-template">{null}</StackVertical>
    </>
  ));
  expect(container.querySelector('[data-space-row="stage"]')).toBeNull();
  expect(byTestId(container, 'own-template')).not.toBeNull();
});

test('a screen not on a template keeps all the room under the space’s row', () => {
  const { container } = renderFrame('ready', () => (
    <StackVertical testId="board">{null}</StackVertical>
  ));
  const people = container.querySelector('[data-space-row="people"]');
  expect(people?.childNodes.length ?? 0).toBe(0);
  expect(container.querySelector('[data-person]')).toBeNull();
  const stage = container.querySelector('[data-space-row="stage"]');
  expect(stage?.getAttribute('data-scroll')).toBe('fixed');
  expect(stage?.contains(byTestId(container, 'board'))).toBe(true);
});
