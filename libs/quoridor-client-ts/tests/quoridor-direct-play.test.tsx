import { expect, test } from 'bun:test';
import { QuoridorBoard } from '@libs/quoridor-client-ts/quoridor-board';
import {
  encodeQuoridor,
  newQuoridor,
  playQuoridor,
  type Quoridor,
} from '@libs/quoridor-shared-ts/quoridor';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal, flush } from 'solid-js';

function mount(mode: Quoridor['mode']) {
  const { clock, timers } = createHarnessClock();
  const [game, setGame] = createSignal(newQuoridor(mode));
  const [interactive, setInteractive] = createSignal(true);
  const play = (action: string) => {
    const next = playQuoridor(game(), action);
    if (!next) throw new Error('Board submitted illegal move ' + action);
    setGame(next);
  };
  const view = renderWithI18n(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        <QuoridorBoard
          position={encodeQuoridor(game())}
          interactive={interactive()}
          testId="direct"
          orientation="white"
          sound={false}
          syncKey={0}
          setup={null}
          hand={null}
          commitment={null}
          committed={[]}
          onAction={play}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  const square = (id: string) => view.getByTestId('direct-action-' + id);
  square('a9').getBoundingClientRect = () => new DOMRect(0, 0, 40, 40);
  square('i1').getBoundingClientRect = () => new DOMRect(320, 320, 40, 40);
  const contact = (x: number, y: number) => ({
    pointerId: 1,
    button: 0,
    clientX: x,
    clientY: y,
  });
  const board = view.getByTestId('direct');
  const tap = (x: number, y: number) => {
    fireEvent.pointerDown(board, contact(x, y));
    fireEvent.pointerUp(board, contact(x, y));
  };
  return { view, square, game, play, tap, board, contact, setInteractive };
}

for (const mode of ['classic', 'hill'] as const) {
  // regression: quoridor-wall-requires-toolbar
  test(
    mode + ' places either wall directly and keeps a refused crossing editable',
    () => {
      const { view, square, game, tap, board, contact } = mount(mode);
      expect(view.queryByTestId('direct-precise-target')).toBeNull();
      tap(148, 200);
      expect(square('d4').dataset['previewEdgeTop']).toBe('true');
      expect(game().actions).toEqual([]);
      tap(148, 200);
      expect(game().actions).toEqual(['d4h']);
      expect(square('d4').dataset['arriving']).toBe('top');
      tap(160, 212);
      tap(160, 212);
      expect(view.getByTestId('direct-wall-refusal').textContent).toContain(
        'crosses'
      );
      expect(game().actions).toEqual(['d4h']);
      fireEvent.pointerDown(board, contact(160, 212));
      fireEvent.pointerMove(board, contact(240, 212));
      expect(square('f4').dataset['previewEdgeRight']).toBe('true');
      fireEvent.pointerUp(board, contact(240, 212));
      fireEvent.click(view.getByTestId('direct-wall-commit'));
      expect(game().actions).toEqual(['d4h', 'f4v']);
      view.unmount();
    }
  );

  test(
    mode + ' animates a received turn and leaves a watcher’s board inert',
    () => {
      const { view, square, game, tap, play, setInteractive } = mount(mode);
      expect(view.container.querySelector('[data-arriving]')).toBeNull();
      fireEvent.click(square('e2'));
      expect(square('e2').dataset['arriving']).toBe('pawn');
      setInteractive(false);
      flush();
      const next = mode === 'classic' ? 'e8' : 'a4';
      play(next);
      flush();
      expect(square('e2').dataset['arriving']).toBeUndefined();
      expect(square(next).dataset['arriving']).toBe('pawn');
      tap(148, 200);
      expect(view.queryByTestId('direct-wall-commit')).toBeNull();
      expect(game().actions).toEqual(['e2', next]);
      view.unmount();
    }
  );
}
