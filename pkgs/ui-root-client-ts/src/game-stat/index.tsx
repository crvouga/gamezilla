import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import styles from '../game-ui.module.css';
import { createScreenSlot } from '../screen-slot';

/**
 * One number a person tracks: what it is, the number in the `stat` role
 * (with an optional tag beside it that qualifies it), and an optional
 * footnote.
 */
export function GameStat(props: {
  label: JSX.Element;
  value: JSX.Element;
  /** Beside the number: one `Badge` that qualifies it ("Provisional"). */
  tag?: JSX.Element | undefined;
  detail?: JSX.Element | undefined;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  // A tag that resolves to nothing (a false `<Show>`) takes no room.
  const tag = createScreenSlot(() => props.tag);
  return (
    <div
      class={styles['stat']}
      {...dataAttrs({ component: 'GameStat', ...props.dataSet })}
    >
      <span class={`${styles['meta']} text textCaption`}>{props.label}</span>
      <span class="box flex-row flex-wrap items-center gap-2 min-w-0">
        <strong class="text textStat">{props.value}</strong>
        <Show when={tag.present()}>{tag.content()}</Show>
      </span>
      <Show when={props.detail}>
        <span class="text textFootnote">{props.detail}</span>
      </Show>
    </div>
  );
}
