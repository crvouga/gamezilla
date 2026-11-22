import { afterEach, expect, test } from 'bun:test';
import {
  ClaimSpaceShell,
  SpaceShellClaimFrame,
} from '@libs/spaces-client-ts/space-shell-claim';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { FadeSwitch } from '@pkgs/ui-root-client-ts/fade-switch';
import { SpaceStageTemplate } from '@pkgs/ui-root-client-ts/space-stage-template';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent } from '@solidjs/testing-library';
import { createSignal, type JSX, onMount, Show } from 'solid-js';

afterEach(cleanup);

const shell = (content: JSX.Element): JSX.Element => (
  <StackVertical testId="shell">{content}</StackVertical>
);

function shells(container: HTMLElement): number {
  return container.querySelectorAll('[data-testid="shell"]').length;
}

test('an unclaimed screen is wrapped in the shell once', () => {
  const { container, getByTestId } = renderWithI18n(() => (
    <SpaceShellClaimFrame shell={shell}>
      <Text testId="screen">{'Games'}</Text>
    </SpaceShellClaimFrame>
  ));
  expect(shells(container)).toBe(1);
  expect(
    container
      .querySelector('[data-testid="shell"]')
      ?.contains(getByTestId('screen'))
  ).toBe(true);
});

test('a claiming screen is rendered bare from its first render', () => {
  const seen: number[] = [];
  const { container, getByTestId } = renderWithI18n(() => (
    <SpaceShellClaimFrame
      shell={(content) => {
        seen.push(1);
        return shell(content);
      }}
    >
      <ClaimSpaceShell />
      <Text testId="screen">{'Chess'}</Text>
    </SpaceShellClaimFrame>
  ));
  expect(shells(container)).toBe(0);
  expect(seen).toEqual([]);
  expect(getByTestId('screen').textContent).toBe('Chess');
});

test('flipping the claim moves the screen without recreating it', () => {
  const [claimed, setClaimed] = createSignal(false);
  let mounts = 0;
  function Screen(): JSX.Element {
    onMount(() => {
      mounts += 1;
    });
    return (
      <>
        <Show when={claimed()}>
          <ClaimSpaceShell />
        </Show>
        <Text testId="screen">{'History'}</Text>
      </>
    );
  }
  const { container, getByTestId } = renderWithI18n(() => (
    <SpaceShellClaimFrame shell={shell}>
      <Screen />
    </SpaceShellClaimFrame>
  ));
  const node = getByTestId('screen');
  expect(shells(container)).toBe(1);
  setClaimed(true);
  expect(shells(container)).toBe(0);
  expect(getByTestId('screen')).toBe(node);
  setClaimed(false);
  expect(shells(container)).toBe(1);
  expect(getByTestId('screen')).toBe(node);
  expect(container.querySelectorAll('[data-testid="screen"]')).toHaveLength(1);
  expect(mounts).toBe(1);
});

/** Time stands still: the frame's moves are all this reads. */
const STILL = {
  clock: { now: () => 0 },
  timers: {
    setTimeout: () => 0,
    clearTimeout: () => undefined,
    setInterval: () => 0,
    clearInterval: () => undefined,
  },
};

// regression: space-shell-claim-release-empties-stage — in a space whose
// frame has siblings, a screen that claimed the shell later (a puzzle's
// board place) and then released it (its settings) moved back into the
// shell's stage, and the frame's swap then removed those same nodes: the
// space showed its rows over an empty stage.
test('a screen that claims and then releases the shell beside siblings stays shown', () => {
  const [place, setPlace] = createSignal<'feed' | 'board'>('feed');
  function Screen(): JSX.Element {
    return (
      <>
        {null}
        {undefined}
        <StackVertical>
          <Text testId="probe">{'probe'}</Text>
          <Show
            when={place() === 'board'}
            fallback={<Text testId="feed">{'Feed'}</Text>}
          >
            <ClaimSpaceShell />
            <Button
              title="Settings"
              onClick={() => setPlace('feed')}
              dataSet={{ testid: 'board' }}
            />
          </Show>
          <Text testId="live">{'live'}</Text>
        </StackVertical>
      </>
    );
  }
  const none = (): void => undefined;
  const Nothing = (): JSX.Element => null;
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={STILL.clock} timers={STILL.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <StackVertical>
          <Text>{'before'}</Text>
          <SpaceShellClaimFrame
            shell={(content) => (
              <SpaceStageTemplate
                spaceName="Space"
                role="host"
                phase="choosing"
                people={[]}
                onBack={none}
                onLeave={none}
                onEnd={none}
                onPersonAction={none}
                dataSet={{ testid: 'shell' }}
              >
                {content}
              </SpaceStageTemplate>
            )}
          >
            <Show when={place() !== undefined}>
              <Nothing />
              <Nothing />
              <FadeSwitch stateKey="game">
                <Screen />
              </FadeSwitch>
            </Show>
          </SpaceShellClaimFrame>
          <Text>{'after'}</Text>
        </StackVertical>
      </ThemeProvider>
    </ClockProvider>
  ));
  const shown = (id: string): boolean =>
    container.querySelector(`[data-testid="${id}"]`) !== null;
  expect(shells(container)).toBe(1);
  setPlace('board');
  expect(shells(container)).toBe(0);
  expect(shown('board')).toBe(true);
  expect(shown('probe')).toBe(true);
  fireEvent.click(
    container.querySelector('[data-testid="board"]') as HTMLElement
  );
  expect(shells(container)).toBe(1);
  for (const id of ['probe', 'feed', 'live']) {
    expect(shown(id)).toBe(true);
    expect(
      container
        .querySelector('[data-testid="shell"]')
        ?.contains(container.querySelector(`[data-testid="${id}"]`))
    ).toBe(true);
  }
});
