import { t } from '@lingui/core/macro';
import {
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';
import { observeElementResize } from '../observe-element-resize';
import { ResponsiveSurface } from '../responsive-surface/index';
import { P } from '../text/index';
import type { WordTileBoardProps } from './index';
import styles from './word-tile-overview.module.css';
import { WordTileRegions } from './word-tile-regions';

/** Whole-board context adjacent to the precision viewport; the outline tracks actual scrolling. */
export function WordTileOverview(props: {
  board: WordTileBoardProps;
  controls: JSX.Element;
  position: string;
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
  return (
    <div class={styles['context']}>
      <WordTileRegions
        board={props.board}
        box={box()}
        onLocate={props.onLocate}
      />
      <div class={styles['tools']}>
        <div class={styles['commands']}>
          {props.controls}
          <button
            type="button"
            class={styles['locator']}
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >{t`Find a square`}</button>
        </div>
        <P variant="caption">{t`View an area`}</P>
        <P variant="caption" testId={`${props.board.testId}-square-details`}>
          {props.position}
        </P>
        <P variant="caption">{t`Outline shows viewing area.`}</P>
      </div>
      <Show when={open()}>
        <ResponsiveSurface
          visible={open()}
          onClose={() => setOpen(false)}
          title={t`Find a square on the board`}
          size="medium"
        >
          <P>{t`Choose a square to view on the enlarged board. This does not place a tile.`}</P>
          {props.locator((id) => {
            setOpen(false);
            props.onLocate(id);
          })}
        </ResponsiveSurface>
      </Show>
    </div>
  );
}
