import { t } from '@lingui/core/macro';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX } from 'solid-js';
import type { WordTileBoardProps } from './index';
import styles from './word-tile-overview.module.css';

/** Nine comfortable region targets preserve board context without placing a tile. */
export function WordTileRegions(props: {
  board: WordTileBoardProps;
  box: { x: number; y: number; width: number; height: number };
  onLocate: (id: string) => void;
}): JSX.Element {
  const columns = () => props.board.columnLabels.length;
  const rows = () => props.board.rowLabels.length;
  const region = (index: number) => {
    const x = Math.floor(((index % 3) * columns()) / 3);
    const y = Math.floor((Math.floor(index / 3) * rows()) / 3);
    const right = Math.ceil((((index % 3) + 1) * columns()) / 3) - 1;
    const bottom = Math.ceil(((Math.floor(index / 3) + 1) * rows()) / 3) - 1;
    const start = `${props.board.columnLabels[x]}${props.board.rowLabels[y]}`;
    const end = `${props.board.columnLabels[right]}${props.board.rowLabels[bottom]}`;
    const center =
      Math.floor((y + bottom) / 2) * columns() + Math.floor((x + right) / 2);
    return { start, end, id: props.board.cells[center]?.id };
  };
  return (
    <div>
      <div
        class={styles['regions']}
        data-testid={`${props.board.testId}-overview`}
      >
        <svg
          class={styles['overview']}
          viewBox={`0 0 ${columns()} ${rows()}`}
          role="img"
          aria-label={t`Whole board overview; outline shows the enlarged area`}
          {...dataAttrs({ component: 'WordTileOverview' })}
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
            x={props.box.x * columns()}
            y={props.box.y * rows()}
            width={props.box.width * columns()}
            height={props.box.height * rows()}
          />
        </svg>
        <div
          class={styles['region-buttons']}
          role="group"
          aria-label={t`View a board region`}
        >
          <For each={Array.from({ length: 9 }, (_, index) => index)}>
            {(index) => (
              <button
                type="button"
                class={styles['region']}
                aria-label={t`View ${region(index).start} to ${region(index).end}`}
                onClick={() => {
                  const id = region(index).id;
                  if (id) props.onLocate(id);
                }}
              >
                <span class={styles['direction']} aria-hidden="true">
                  {['↖', '↑', '↗', '←', '•', '→', '↙', '↓', '↘'][index]}
                </span>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
