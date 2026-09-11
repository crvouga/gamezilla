import { ChessBoard } from '@pkgs/chess-board/chess-board';
import {
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';

const SAMPLE_FEN =
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';

const MAX_BOARD_SIZE = 280;

export default function ChessBoardExample(): JSX.Element {
  const [size, setSize] = createSignal(MAX_BOARD_SIZE);
  const [hostEl, setHostEl] = createSignal<HTMLElement>();

  createEffect(() => {
    const el = hostEl();
    if (el === undefined) return;
    const measure = (): void => {
      const next = Math.min(
        MAX_BOARD_SIZE,
        Math.floor(el.getBoundingClientRect().width)
      );
      if (next > 0) setSize((prev) => (prev === next ? prev : next));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    onCleanup(() => ro.disconnect());
  });

  return (
    <div
      class="box gap-3 items-stretch w-[100%] max-w-[360px] min-w-[0]"
      ref={setHostEl}
    >
      <p class="text textCaption text-text-secondary">
        {'Interactive Solid chess board.'}
      </p>
      <Show when={size() > 0}>
        <ChessBoard
          fen={SAMPLE_FEN}
          size={size()}
          interactive
          showCoordinates
          highlightLastMove
        />
      </Show>
    </div>
  );
}
