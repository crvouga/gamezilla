import { indexFromSquare } from '@pkgs/chess-board-core-shared-ts/geometry';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import { squareAt } from '@pkgs/chess-board-root-shared-ts/board-box';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import type { JSX } from '@solidjs/web';
import { createSignal, onCleanup, Show } from 'solid-js';
import type { BoardController } from '../chess-board-controller';
import { squareName } from '../chess-board-hit-grid/index';
import { InspectionGesture } from './gesture';
import styles from './inspection.module.css';

/** Magnifies its playable board around the inspection gesture. While magnified,
 * the surface is inert so reading or panning it cannot submit a move. */
export function ChessBoardInspection(props: {
  readonly ctrl: BoardController;
  readonly fixed: boolean;
  readonly children: JSX.Element;
}) {
  const timers = useTimers();
  const [inspecting, setInspecting] = createSignal(false);
  const [square, setSquare] = createSignal<Square | null>(null);
  let gesture: InspectionGesture | undefined;
  let surface: HTMLDivElement | undefined;
  const bind = (viewport: HTMLDivElement) => {
    gesture = new InspectionGesture(viewport, {
      timers,
      cancelPlay: props.ctrl.cancelPress,
      mayInspect: () =>
        props.ctrl.model.interaction().pendingPromotion === null,
      mayHold: () => {
        const press = props.ctrl.session.state();
        return (
          press.kind === 'press' &&
          props.ctrl.model.interaction().selected === null &&
          props.ctrl.model.game().position[indexFromSquare(press.square)] ===
            null
        );
      },
      read(point) {
        const board = surface?.firstElementChild;
        if (!(board instanceof HTMLElement)) return;
        const width = props.ctrl.boardPx() || board.offsetWidth;
        setSquare(
          squareAt(
            { left: 0, top: 0, size: width - 2 * board.clientLeft },
            {
              x: point.x * width - board.clientLeft,
              y: point.y * width - board.clientTop,
            },
            props.ctrl.orientation()
          )
        );
      },
      paint(view) {
        if (!surface) return;
        const zoomed = view.scale > 1;
        surface.style.transform = zoomed
          ? `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.scale})`
          : '';
        if (zoomed && !surface.inert) viewport.focus({ preventScroll: true });
        if (!zoomed) setSquare(null);
        surface.inert = zoomed;
        setInspecting(zoomed);
      },
    });
  };
  onCleanup(() => gesture?.dispose());
  return (
    <div
      ref={bind}
      class={[styles['viewport'], { [styles['fixed'] ?? '']: props.fixed }]}
      tabindex={-1}
      data-chess-inspection={inspecting() ? 'magnified' : 'fit'}
    >
      <div ref={surface} class={styles['surface']}>
        {props.children}
      </div>
      <Show when={inspecting()}>
        <div data-chess-fit="" class={styles['fit']}>
          <Show when={square()}>
            {(at) => (
              <span class={styles['readout']} aria-live="polite">
                {squareName(at(), props.ctrl.model.game().position)}
              </span>
            )}
          </Show>
          <Button
            size="sm"
            title={<Trans>Fit board</Trans>}
            onClick={() => gesture?.fit()}
          />
        </div>
      </Show>
    </div>
  );
}
