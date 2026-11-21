import { afterEach, expect, mock, test } from 'bun:test';
import { SpaceGameChoiceView } from '@libs/spaces-client-ts/space-game-choice-view';
import type { SpaceScreenChromeValue } from '@libs/spaces-client-ts/space-screen-chrome';
import {
  AVERY,
  GUESTS,
  STORY_GAME_FAMILIES,
  storyChrome,
} from '@libs/spaces-client-ts/spaces-story.example';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

afterEach(cleanup);

function mount(
  chrome: SpaceScreenChromeValue,
  canChoose: boolean
): ReturnType<typeof mock> {
  const onChoose = mock();
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <SurfaceStackProvider>
          <SpaceGameChoiceView
            chrome={chrome}
            families={STORY_GAME_FAMILIES}
            canChoose={canChoose}
            onChoose={onChoose}
          />
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return onChoose;
}

// regression: space-guest-invited-to-pick-game
test('a guest is told the host is choosing, and no game can be picked', () => {
  const onChoose = mount(storyChrome('guest'), false);
  expect(screen.getByTestId(Handles.spaceHostChoosesGame).textContent).toBe(
    'avery is choosing a game'
  );
  expect(screen.queryByText(/Pick a game/)).toBeNull();
  const tile = screen.getByTestId(Handles.gameMenu('example-board'));
  expect(tile.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(tile);
  fireEvent.click(screen.getByTestId(Handles.gameFamily('example-race')));
  expect(onChoose).not.toHaveBeenCalled();
  expect(screen.queryByTestId(Handles.gameMenu('example-race-3'))).toBeNull();
});

// regression: game-chooser-hides-the-room
test('the game choice shows everyone here, the host first', () => {
  mount(storyChrome('host'), true);
  const people = [...document.querySelectorAll('[data-person]')].map((cell) =>
    cell.getAttribute('data-person')
  );
  expect(people).toEqual([AVERY.id, ...GUESTS.map((guest) => guest.id)]);
  expect(screen.getByText('Pick a game for 5 players')).toBeTruthy();
});

// regression: space-games-no-visible-invite
test('the game choice offers Invite beside who is here', () => {
  const onInvite = mock();
  mount({ ...storyChrome('host'), onInvite }, true);
  fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
  expect(onInvite).toHaveBeenCalledTimes(1);
});

test('the host picks a lone game with its tile', () => {
  const onChoose = mount(storyChrome('host'), true);
  expect(screen.queryByTestId(Handles.spaceHostChoosesGame)).toBeNull();
  fireEvent.click(screen.getByTestId(Handles.gameMenu('example-cards')));
  expect(onChoose).toHaveBeenCalledWith('example-cards');
});

test('a family of modes is one tile, and its modes are picked after it', () => {
  const onChoose = mount(storyChrome('host'), true);
  expect(screen.getAllByText('Light Cycles')).toHaveLength(1);
  expect(screen.queryByTestId(Handles.gameMenu('example-race'))).toBeNull();
  fireEvent.click(screen.getByTestId(Handles.gameFamily('example-race')));
  expect(onChoose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId(Handles.gameMenu('example-race-3')));
  expect(onChoose).toHaveBeenCalledWith('example-race-3');
});
