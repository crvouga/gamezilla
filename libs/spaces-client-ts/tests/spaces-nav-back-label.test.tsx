/** @jsxImportSource solid-js */
/** The space bar's Back names where it goes, from every game screen. */

import { afterEach, expect, test } from 'bun:test';
import {
  DefineBackButton,
  GameChoicesName,
  SpacesNavProvider,
  useGameChoicesName,
  useSpacesNavBackLabel,
  useSpacesNavPlace,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { cleanup } from '@solidjs/testing-library';
import { createSignal, type JSX, Show } from 'solid-js';

afterEach(cleanup);

/** A screen the game's choices open, whose Back returns to them. */
function OpenedScreen(): JSX.Element {
  const choices = useGameChoicesName();
  return <DefineBackButton onPress={() => undefined} label={choices()} />;
}

function BackLabel(): JSX.Element {
  const label = useSpacesNavBackLabel();
  return <output data-testid="back-label">{label() ?? 'Back'}</output>;
}

// regression: game-screens-back-unnamed — setup, matchmaking, boards and
// puzzles offered only a bare Back (or, in the review sheets, none), so the
// way back towards the space's games was not visible from a game screen.
test('a screen opened from a game’s choices names them on Back; the choices name the games', () => {
  const [opened, setOpened] = createSignal(true);
  const view = renderWithI18n(() => (
    <SpacesNavProvider>
      <GameChoicesName name="Connect Four">
        <Show
          when={opened()}
          fallback={
            <DefineBackButton onPress={() => undefined} label="Games" />
          }
        >
          <OpenedScreen />
        </Show>
      </GameChoicesName>
      <BackLabel />
    </SpacesNavProvider>
  ));
  expect(view.getByTestId('back-label').textContent).toBe('Connect Four');
  setOpened(false);
  expect(view.getByTestId('back-label').textContent).toBe('Games');
});

test('outside a game’s choices a Back stays unnamed', () => {
  const view = renderWithI18n(() => (
    <SpacesNavProvider>
      <OpenedScreen />
      <BackLabel />
    </SpacesNavProvider>
  ));
  expect(view.getByTestId('back-label').textContent).toBe('Back');
});

function Place(): JSX.Element {
  const place = useSpacesNavPlace();
  return <output data-testid="place">{place() ?? 'none'}</output>;
}

// regression: space-bar-competing-nav-controls
test('the selected game names itself to the bar while its screens show', () => {
  const [chosen, setChosen] = createSignal(true);
  const view = renderWithI18n(() => (
    <SpacesNavProvider>
      <Show when={chosen()}>
        <GameChoicesName name="Chess">
          <OpenedScreen />
        </GameChoicesName>
      </Show>
      <Place />
    </SpacesNavProvider>
  ));
  expect(view.getByTestId('place').textContent).toBe('Chess');
  setChosen(false);
  expect(view.getByTestId('place').textContent).toBe('none');
});
