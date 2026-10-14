/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { MainMenuScreen } from '@pkgs/ui-root-client/main-menu-screen';
import { SCREEN_MAX_WIDTH } from '@pkgs/ui-root-client/screen-measure';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { cssOf, mustQuery, renderUi } from './render';

describe('MainMenuScreen', () => {
  test('renders header, helper, rows, footer and data-screen', () => {
    renderUi(() => (
      <MainMenuScreen
        screenId="games"
        title="Games"
        subtitle="Pick one"
        helper="Tap a game to start"
        items={[
          { key: 'chess', title: 'Chess', caption: 'Puzzles & play' },
          { key: 'c4', title: 'Connect Four', selected: true },
        ]}
        footer={<p class="text">{'footer'}</p>}
      />
    ));
    const root = mustQuery('[data-component="MainMenuScreen"]');
    expect(root.getAttribute('data-screen')).toBe('games');
    const content = mustQuery('[data-component="ScrollViewContent"]');
    expect(cssOf(content)).toContain(`max-width:${SCREEN_MAX_WIDTH.reading}px`);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Games');
    expect(screen.getByText('Pick one')).toBeTruthy();
    expect(screen.getByText('Tap a game to start')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Puzzles & play')).toBeTruthy();
    expect(screen.getByText('footer')).toBeTruthy();
    expect(
      document.querySelectorAll('[data-component="MainMenuItem"]')
    ).toHaveLength(2);
  });

  test('rows with onClick are buttons; disabled rows do not fire', async () => {
    const user = userEvent.setup();
    const onChess = mock();
    const onLocked = mock();
    renderUi(() => (
      <MainMenuScreen
        screenId="games"
        items={[
          { key: 'chess', title: 'Chess', onClick: onChess },
          { key: 'locked', title: 'Locked', onClick: onLocked, disabled: true },
          { key: 'static', title: 'Static' },
        ]}
      />
    ));
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /chess/i }));
    expect(onChess).toHaveBeenCalledTimes(1);
    const locked = screen.getByRole('button', { name: /locked/i });
    expect(locked.hasAttribute('disabled')).toBe(true);
    await user.click(locked);
    expect(onLocked).not.toHaveBeenCalled();
  });

  test('renders custom trailing slot', () => {
    renderUi(() => (
      <MainMenuScreen
        screenId="games"
        items={[
          { key: 'a', title: 'A', trailing: <p class="text">{'NEW'}</p> },
        ]}
      />
    ));
    expect(screen.getByText('NEW')).toBeTruthy();
  });
});
