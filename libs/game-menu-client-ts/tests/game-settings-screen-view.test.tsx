/** @jsxImportSource solid-js */
/** A settings group is a hub: rows that lead onward, or a word that none do. */
import { expect, mock, test } from 'bun:test';
import type { GameSettingsPlace } from '@libs/game-menu-client-ts/game-settings';
import { GameSettingsScreenView } from '@libs/game-menu-client-ts/game-settings-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';

const ROOT: GameSettingsPlace = { screen: 'settings' };
const DEVELOPER: GameSettingsPlace = { screen: 'settings/developer' };

function group(
  rows: Parameters<typeof GameSettingsScreenView>[0]['rows'],
  onOpen: (place: GameSettingsPlace) => void = () => undefined
) {
  return renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width: 390, height: 844 }}>
      <GameSettingsScreenView
        place={ROOT}
        title="Settings"
        subtitle="Developer tools."
        rows={rows}
        onOpen={onOpen}
      />
    </ThemeProvider>
  ));
}

test('each row opens the place it names, by its own control', () => {
  const onOpen = mock((_place: GameSettingsPlace) => undefined);
  const view = group(
    [
      {
        key: 'developer',
        title: 'Developer',
        caption: 'Puzzle import tools.',
        testId: 'race-settings-developer',
        opens: DEVELOPER,
      },
    ],
    onOpen
  );
  expect(view.getByText('Settings')).toBeTruthy();
  expect(view.getByText('Puzzle import tools.')).toBeTruthy();
  view.getByTestId('race-settings-developer').click();
  expect(onOpen).toHaveBeenCalledWith(DEVELOPER);
  expect(view.queryByTestId('game-settings-empty')).toBeNull();
  view.unmount();
});

test('a group with no row the person may see says so, with the way out', () => {
  const view = group([]);
  expect(view.getByTestId('game-settings-empty').textContent).toContain(
    'Nothing to open here'
  );
  expect(view.getByTestId('game-settings-empty').textContent).toContain(
    'Go back'
  );
  view.unmount();
});
