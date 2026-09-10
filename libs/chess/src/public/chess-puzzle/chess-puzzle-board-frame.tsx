import {
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';

/** Matches `@pkgs/ui-testing-solid-dom` `ELEMENT_LAYOUT_EVENT` (no dep edge). */
const ELEMENT_LAYOUT_EVENT = 'ui-testing:element-layout';

function squareFitSize(
  width: number,
  height: number,
  reserveTop: number
): number {
  return Math.floor(Math.min(width, Math.max(0, height - reserveTop)));
}

export type ChessPuzzleBoardFrameProps = {
  children: (size: number) => JSX.Element;
  overlay?: JSX.Element;
  topAccessory?: JSX.Element;
  topAccessoryHeight?: number;
};

export function ChessPuzzleBoardFrame(
  props: ChessPuzzleBoardFrameProps
): JSX.Element {
  const [size, setSize] = createSignal(0);
  const [hostEl, setHostEl] = createSignal<HTMLElement>();
  const reserveTop = (): number => Math.max(0, props.topAccessoryHeight ?? 0);

  createEffect(() => {
    const el = hostEl();
    if (el === undefined) return;
    const measure = (): void => {
      const rect = el.getBoundingClientRect();
      const next = squareFitSize(rect.width, rect.height, reserveTop());
      if (next > 0) {
        setSize((prev) => (prev === next ? prev : next));
      }
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    // Headless drivers synthesize getBoundingClientRect after mount; re-measure
    // so `<Show when={size() > 0}>` can mount the board.
    el.addEventListener(ELEMENT_LAYOUT_EVENT, measure);
    onCleanup(() => {
      ro.disconnect();
      el.removeEventListener(ELEMENT_LAYOUT_EVENT, measure);
    });
  });

  return (
    <div
      class="box flex-1 min-h-[0] self-stretch items-center justify-center"
      data-testid="chess-puzzle-board-frame"
      ref={setHostEl}
    >
      <Show when={size() > 0}>
        <div class="box" style={{ width: `${size()}px` }}>
          <Show when={reserveTop() > 0} fallback={props.topAccessory}>
            <div class="box" style={{ height: `${reserveTop()}px` }}>
              {props.topAccessory}
            </div>
          </Show>
          <div
            class="box relative"
            style={{ width: `${size()}px`, height: `${size()}px` }}
          >
            {props.children(size())}
            {props.overlay}
          </div>
        </div>
      </Show>
    </div>
  );
}
