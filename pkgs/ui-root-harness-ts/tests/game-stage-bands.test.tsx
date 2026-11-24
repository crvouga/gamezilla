/** @jsxImportSource @solidjs/web */

import { describe, expect, test } from 'bun:test';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
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
  overrides: Partial<Parameters<typeof GameSessionLayout>[0]> = {}
): () => JSX.Element {
  return () => (
    <GameSessionLayout
      fixedStage
      actionsBeside
      actions={<button type="button">{'Resign'}</button>}
      {...overrides}
    >
      <div data-testid="board" />
    </GameSessionLayout>
  );
}

const layout = () => mustQuery('[data-component="GameSessionLayout"]');

describe('GameSessionLayout fixed stage', () => {
  test('notices lie over the stage instead of in its flow', () => {
    renderUi(stage({ notices: <p data-testid="offline">{'Offline'}</p> }));
    const notices = mustQuery('[data-component="GameStageNotices"]');
    expect(notices.contains(screen.getByTestId('offline'))).toBe(true);
    // The session's own rows are only the layout and the notices layer.
    expect(
      [...layout().children].map((child) =>
        child.getAttribute('data-component')
      )
    ).toEqual(['GameStageNotices', 'GameLayout']);
  });

  test('without notices there is no layer, and nothing else moves', () => {
    renderUi(stage());
    expect(
      document.querySelector('[data-component="GameStageNotices"]')
    ).toBeNull();
    expect(
      [...layout().children].map((child) =>
        child.getAttribute('data-component')
      )
    ).toEqual(['GameLayout']);
  });

  test('the status band and the line of moves are there before anything fills them', () => {
    renderUi(stage());
    expect(
      document.querySelector('[data-component="GameStageStatus"]')
    ).not.toBeNull();
    expect(
      mustQuery('[data-game-slot="rail"] [data-component="GameStageStrip"]')
    ).toBeTruthy();
  });

  test('the outcome sheet sits with the commands, never in the stage', () => {
    renderUi(stage({ sheet: <p data-testid="outcome">{'You win'}</p> }));
    const sheet = mustQuery('[data-component="GameStageSheet"]');
    expect(sheet.contains(screen.getByTestId('outcome'))).toBe(true);
    expect(sheet.closest('[data-game-slot="controls"]')).not.toBeNull();
    expect(sheet.closest('[data-game-slot="stage"]')).toBeNull();
  });

  test('the line of moves leads to all of them', () => {
    let pressed = 0;
    renderUi(
      stage({
        aside: <p>{'1. e4'}</p>,
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
    const before = mustQuery('[data-component="GameLayout"]');
    setOffline(true);
    flush();
    expect(mustQuery('[data-component="GameLayout"]')).toBe(before);
    expect(
      document.querySelector('[data-component="GameStageNotices"]')
    ).not.toBeNull();
    setOffline(false);
    flush();
    expect(
      document.querySelector('[data-component="GameStageNotices"]')
    ).toBeNull();
  });
});
