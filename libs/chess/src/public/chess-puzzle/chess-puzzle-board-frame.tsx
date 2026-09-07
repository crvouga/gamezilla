import { Box } from '@pkgs/ui';
import {
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';

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
    onCleanup(() => ro.disconnect());
  });

  return (
    <Box
      ref={setHostEl}
      dataSet={{ testid: 'chess-puzzle-board-frame' }}
      sx={{
        flex: 1,
        minHeight: 0,
        alignSelf: 'stretch',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Show when={size() > 0}>
        <Box sx={{ width: size() }}>
          <Show when={reserveTop() > 0} fallback={props.topAccessory}>
            <Box sx={{ height: reserveTop() }}>{props.topAccessory}</Box>
          </Show>
          <Box sx={{ width: size(), height: size(), position: 'relative' }}>
            {props.children(size())}
            {props.overlay}
          </Box>
        </Box>
      </Show>
    </Box>
  );
}
