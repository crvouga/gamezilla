import { t } from '@lingui/core/macro';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX } from 'solid-js';
import type { WordTileBoardCell } from '../word-tile-board/index';
import styles from './word-tile-workbench.module.css';

/** Read-only neighboring squares keep a blank's location visible during assignment. */
export function WordTileBlankContext(props: {
  cells: readonly WordTileBoardCell[];
  index: number;
  summary: string;
  testId: string;
}): JSX.Element {
  const nearby = () => {
    const left = Math.max(0, Math.min(8, (props.index % 15) - 3));
    const top = Math.max(0, Math.min(12, Math.floor(props.index / 15) - 1));
    const cells = props.cells;
    return Array.from(
      { length: 21 },
      (_, i) => cells[(top + Math.floor(i / 7)) * 15 + left + (i % 7)]
    ).filter((cell): cell is WordTileBoardCell => cell !== undefined);
  };
  return (
    <div
      {...dataAttrs({
        component: 'WordTileBlankContext',
        testid: `${props.testId}-blank-context`,
      })}
    >
      <p
        class={styles['context-copy']}
      >{t`Blank at ${props.cells[props.index]?.id ?? ''}. ${props.summary}`}</p>
      <p
        class={styles['context-copy']}
      >{t`Nearby squares: ${nearby()[0]?.id ?? ''} to ${nearby().at(-1)?.id ?? ''}`}</p>
      <div
        class={styles['neighbors']}
        role="group"
        aria-label={t`Nearby squares; outlined square is your blank`}
      >
        <For each={nearby()}>
          {(cell) => (
            <div
              class={styles['neighbor']}
              data-blank={cell.id === props.cells[props.index]?.id}
              aria-label={cell.label}
            >
              <strong>
                {cell.letter !== ''
                  ? cell.letter
                  : cell.square === 'start'
                    ? '★'
                    : (cell.square ?? '·')}
              </strong>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
