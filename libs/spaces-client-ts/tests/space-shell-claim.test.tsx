import { afterEach, expect, test } from 'bun:test';
import {
  ClaimSpaceShell,
  SpaceShellClaimFrame,
} from '@libs/spaces-client-ts/space-shell-claim';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { cleanup } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import { createSignal, flush, onSettled, Show } from 'solid-js';

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
    onSettled(() => {
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
  flush();
  expect(shells(container)).toBe(0);
  expect(getByTestId('screen')).toBe(node);
  setClaimed(false);
  flush();
  expect(shells(container)).toBe(1);
  expect(getByTestId('screen')).toBe(node);
  expect(container.querySelectorAll('[data-testid="screen"]')).toHaveLength(1);
  expect(mounts).toBe(1);
});
