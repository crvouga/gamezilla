import { t } from '@lingui/core/macro';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  createEffect,
  createSignal,
  For,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';
import { observeElementResize } from '../observe-element-resize';
import { ResponsiveSurface } from '../responsive-surface/index';
import { P } from '../text/index';
import type { WordTileBoardProps } from './index';
import styles from './word-tile-overview.module.css';

/** Whole-board context beside the precision viewport; the outline tracks actual scrolling. */
export function WordTileOverview(props: {
  board: WordTileBoardProps;
  viewport: () => HTMLDivElement | undefined;
  locator: (onChoose: (id: string) => void) => JSX.Element;
  onLocate: (id: string) => void;
}): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const [box, setBox] = createSignal({ x: 0, y: 0, width: 1, height: 1 });
  createEffect(() => {
    const viewport = props.viewport();
    if (!viewport) return;
    const read = () =>
      setBox({
        x: viewport.scrollLeft / Math.max(1, viewport.scrollWidth),
        y: viewport.scrollTop / Math.max(1, viewport.scrollHeight),
        width: viewport.clientWidth / Math.max(1, viewport.scrollWidth),
        height: viewport.clientHeight / Math.max(1, viewport.scrollHeight),
      });
    read();
    viewport.addEventListener('scroll', read);
    const stop = observeElementResize(viewport, read);
    onCleanup(() => {
      viewport.removeEventListener('scroll', read);
      stop();
    });
  });
  const columns = () => props.board.columnLabels.length;
  const rows = () => props.board.rowLabels.length;
  return (
    <>
      <button
        type="button"
        class={styles['locator']}
        aria-label={t`Board map: locate a square`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <svg
          class={styles['overview']}
          viewBox={`0 0 ${columns()} ${rows()}`}
          role="img"
          aria-label={t`Whole board overview; outline shows the enlarged area`}
          {...dataAttrs({ component: 'WordTileOverview' })}
          data-testid={`${props.board.testId}-overview`}
        >
          <For each={props.board.cells}>
            {(cell, index) => (
              <rect
                x={index() % columns()}
                y={Math.floor(index() / columns())}
                width="1"
                height="1"
                class={styles['square']}
                data-state={cell.state}
                data-square={cell.square ?? 'none'}
              />
            )}
          </For>
          <rect
            class={styles['window']}
            data-viewport-indicator="true"
            x={box().x * columns()}
            y={box().y * rows()}
            width={box().width * columns()}
            height={box().height * rows()}
          />
        </svg>
        <span>{t`Map`}</span>
      </button>
      <Show when={open()}>
        <ResponsiveSurface
          visible={open()}
          onClose={() => setOpen(false)}
          title={t`Board map`}
          size="medium"
        >
          <P>{t`Choose a square to view on the enlarged board. This does not place a tile.`}</P>
          {props.locator((id) => {
            setOpen(false);
            props.onLocate(id);
          })}
        </ResponsiveSurface>
      </Show>
    </>
  );
}
