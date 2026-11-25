import type { JSX } from '@solidjs/web';
import { createMemo, Show } from 'solid-js';
import type { PathGridLine } from '../path-grid-types';
import styles from './numberlink-cable.module.css';
import boardStyles from './path-grid-board.module.css';

export function NumberlinkCable(props: {
  line: PathGridLine;
  columns: number;
}): JSX.Element {
  const x = (cell: number) => ((cell % props.columns) + 0.5) * 100;
  const y = (cell: number) => (Math.floor(cell / props.columns) + 0.5) * 100;
  const points = createMemo(() =>
    props.line.cells.map((cell) => `${x(cell)},${y(cell)}`).join(' ')
  );
  const tip = createMemo(() =>
    props.line.connected ? undefined : props.line.cells.at(-1)
  );
  return (
    <g data-tone={props.line.tone}>
      <polyline
        class={boardStyles['line']}
        data-path={props.line.id}
        data-tone={props.line.tone}
        data-connected={String(props.line.connected)}
        data-provisional={String(props.line.provisional === true)}
        points={points()}
      />
      <Show when={props.line.cells.length > 1}>
        <path class={styles['thread']} d={`M${points()}`} />
      </Show>
      <Show when={tip() !== undefined}>
        <circle
          class={styles['tip']}
          cx={x(tip() ?? 0)}
          cy={y(tip() ?? 0)}
          r="11"
        />
      </Show>
    </g>
  );
}
