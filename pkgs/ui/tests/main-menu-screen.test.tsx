/** @jsxImportSource solid-js */
import { Text } from '@pkgs/ui';
import {
  MAIN_MENU_SCREEN_MAX_WIDTH,
  MainMenuScreen,
  resolveNeutralGradient,
} from '@pkgs/ui/components/main-menu-screen';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { cssOf, mustQuery, renderUi } from './support/render';

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
        footer={<Text label="footer" />}
      />
    ));
    const root = mustQuery('[data-component="MainMenuScreen"]');
    expect(root.getAttribute('data-screen')).toBe('games');
    expect(cssOf(root)).toContain(`max-width:${MAIN_MENU_SCREEN_MAX_WIDTH}px`);
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
    const onChess = vi.fn();
    const onLocked = vi.fn();
    renderUi(() => (
      <MainMenuScreen
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
        items={[{ key: 'a', title: 'A', trailing: <Text label="NEW" /> }]}
      />
    ));
    expect(screen.getByText('NEW')).toBeTruthy();
  });
});

describe('resolveNeutralGradient', () => {
  test('brightens the top and darkens the bottom of a parseable color', () => {
    const g = resolveNeutralGradient('hsla(240, 5%, 96%, 1)');
    expect(g.top).not.toBe(g.bottom);
    expect(g.top).toMatch(/^hsla\(/);
    expect(g.bottom).toMatch(/^hsla\(/);
  });

  test('falls back to a flat fill for unparseable input', () => {
    const g = resolveNeutralGradient('var(--ui-color-surface)');
    expect(g).toEqual({
      top: 'var(--ui-color-surface)',
      bottom: 'var(--ui-color-surface)',
    });
  });
});
