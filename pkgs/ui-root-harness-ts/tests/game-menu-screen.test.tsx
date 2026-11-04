/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { GameMenuScreen } from '@pkgs/ui-root-client-ts/game-menu-screen';
import { HistoryIcon, UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';

function menu(width: number, onPlay: () => void) {
  return render(() => (
    <ThemeProvider colorScheme="light" fixedLayout={{ width, height: 900 }}>
      <GameMenuScreen
        screenId="game-choices"
        title="Connect Four"
        motif="discs"
        subtitle="Drop discs and line up four"
        description="Four in a row wins."
        choices={[
          {
            key: 'custom-game',
            title: 'Play with friends or bots',
            caption: 'Choose who plays',
            icon: UsersIcon,
            emphasis: 'primary',
            dataSet: { testid: 'choice-play' },
            onClick: onPlay,
          },
          {
            key: 'history',
            title: 'History and stats',
            icon: HistoryIcon,
            emphasis: 'quiet',
            dataSet: { testid: 'choice-history' },
            onClick: () => undefined,
          },
        ]}
      />
    </ThemeProvider>
  ));
}

describe('GameMenuScreen', () => {
  test('wide: the game heads its menu, every choice a tile, the main way in leading', () => {
    const onPlay = mock(() => undefined);
    const view = menu(1440, onPlay);
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe(
      'Connect Four'
    );
    expect(view.getByText('Four in a row wins.')).toBeTruthy();
    const tiles = view.getAllByRole('listitem');
    expect(tiles).toHaveLength(2);
    const play = view.getByTestId('choice-play');
    expect(play.getAttribute('data-emphasis')).toBe('primary');
    expect(play.getAttribute('data-component')).toBe('GameMenuChoice');
    fireEvent.click(play);
    expect(onPlay).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  test('phone: the same choices as one panel of menu rows', () => {
    const view = menu(390, () => undefined);
    expect(view.getByTestId('choice-play').getAttribute('data-component')).toBe(
      'MainMenuItem'
    );
    expect(view.getByText('Four in a row wins.')).toBeTruthy();
    view.unmount();
  });
});
