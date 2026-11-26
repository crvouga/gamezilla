/** @jsxImportSource @solidjs/web */

import { describe, expect, test } from 'bun:test';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { FixedGameSession } from '@pkgs/ui-root-client-ts/game-session-layout';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { fireEvent, screen } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import { createSignal, flush, Show } from 'solid-js';
import { mustQuery, renderUi } from './render';

/**
 * A fixed stage keeps every part around its board in a band of its own, so
 * nothing that comes or goes during a game is laid out in the board's flow
 * (the board's pixels are proven by the Storybook stage stability check).
 */
function stage(
  overrides: Partial<Parameters<typeof FixedGameSession>[0]> = {}
): () => JSX.Element {
  return () => (
    <SurfaceStackProvider>
      <FixedGameSession
        actions={<button type="button">{'Resign'}</button>}
        {...overrides}
      >
        {(information) => (
          <GameBoardStage information={information} others={<p>Players</p>}>
            <div data-testid="board" />
          </GameBoardStage>
        )}
      </FixedGameSession>
    </SurfaceStackProvider>
  );
}

const layout = () => mustQuery('[data-component="GameSessionLayout"]');

describe('GameSessionLayout fixed stage', () => {
  test('notices float in the alerts stack, outside the session entirely', () => {
    renderUi(stage({ notices: <p data-testid="offline">{'Offline'}</p> }));
    const notices = mustQuery('[data-component="GameSessionNotices"]');
    expect(notices.contains(screen.getByTestId('offline'))).toBe(true);
    expect(layout().contains(notices)).toBe(false);
    // The session's own rows are only the layout.
    expect(
      [...layout().children].map((child) =>
        child.getAttribute('data-game-slot')
      )
    ).toEqual(['stage', 'controls']);
  });

  test('without notices there is no layer, and nothing else moves', () => {
    renderUi(stage());
    expect(
      document.querySelector('[data-component="GameSessionNotices"]')
    ).toBeNull();
    expect(
      [...layout().children].map((child) =>
        child.getAttribute('data-game-slot')
      )
    ).toEqual(['stage', 'controls']);
  });

  test('the status band and the line of moves are there before anything fills them', () => {
    renderUi(stage());
    expect(
      document.querySelector('[data-component="GameStageStatus"]')
    ).not.toBeNull();
    expect(mustQuery('[data-game-slot="history"]')).toBeTruthy();
  });

  test('the outcome is a dialog with the commands in it, and the bar keeps its height', () => {
    renderUi(stage({ sheet: <p data-testid="outcome">{'You win'}</p> }));
    const dialog = screen.getByRole('dialog', { name: 'Game over' });
    expect(dialog.contains(screen.getByTestId('outcome'))).toBe(true);
    expect(
      dialog.contains(screen.getByRole('button', { name: 'Resign' }))
    ).toBe(true);
    expect(dialog.closest('[data-game-slot="stage"]')).toBeNull();
    // The bar holds a placeholder of its commands' height while they are
    // in the dialog, so nothing above it moves.
    const controls = mustQuery('[data-game-slot="controls"]');
    expect(controls.querySelector('button')).toBeNull();
    // Closed, the commands come back to the bar with a way to reopen it.
    fireEvent.click(screen.getByTestId('game-result-close'));
    expect(screen.queryByRole('dialog', { name: 'Game over' })).toBeNull();
    expect(
      controls.contains(screen.getByRole('button', { name: 'Resign' }))
    ).toBe(true);
    fireEvent.click(screen.getByTestId('game-show-result'));
    expect(screen.getByRole('dialog', { name: 'Game over' })).toBeTruthy();
  });

  test('the line of moves leads to all of them', () => {
    let pressed = 0;
    renderUi(
      stage({
        history: <p>{'1. e4'}</p>,
        allMoves: {
          label: 'All moves',
          testId: 'all-moves',
          onPress: () => {
            pressed += 1;
          },
        },
      })
    );
    const link = screen.getByTestId('all-moves');
    expect(link.closest('[data-component="GameStageStrip"]')).not.toBeNull();
    fireEvent.click(link);
    expect(pressed).toBe(1);
  });

  test('a notice that comes and goes changes only its own layer', () => {
    const [offline, setOffline] = createSignal(false);
    renderUi(
      stage({
        notices: (
          <Show when={offline()}>
            <p>{'Offline'}</p>
          </Show>
        ),
      })
    );
    const before = mustQuery('[data-game-board-stage]');
    setOffline(true);
    flush();
    expect(mustQuery('[data-game-board-stage]')).toBe(before);
    expect(
      document.querySelector('[data-component="GameSessionNotices"]')
    ).not.toBeNull();
    setOffline(false);
    flush();
    expect(
      document.querySelector('[data-component="GameSessionNotices"]')
    ).toBeNull();
  });
});
