import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import styles from '../game-ui.module.css';
import { ProgressBar } from '../progress-bar/index';
import { createScreenSlot } from '../screen-slot';
import statStyles from './game-stat.module.css';

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
  /**
   * How far the number is toward something it is working to (a rating's
   * placement games), 0..1: a thin bar between the number and `detail`,
   * named by `progressLabel`.
   */
  progress?: number | undefined;
  progressLabel?: string | undefined;
  /**
   * `compact`: the number at a label's size, for a stat that supports a
   * choice beside it (a rating beside Find an opponent) rather than being
   * the thing read first. `regular` (the default) is the `stat` role.
   */
  size?: 'regular' | 'compact' | undefined;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  // A tag that resolves to nothing (a false `<Show>`) takes no room.
  const tag = createScreenSlot(() => props.tag);
  return (
    <div
      class={styles['stat']}
      {...dataAttrs({
        component: 'GameStat',
        size: props.size ?? 'regular',
        ...props.dataSet,
      })}
    >
      <span class={`${styles['meta']} text textCaption`}>{props.label}</span>
      <span class="box flex-row flex-wrap items-center gap-2 min-w-0">
        <strong
          class="text"
          classList={{
            textStat: props.size !== 'compact',
            textLabel: props.size === 'compact',
            [statStyles['compactValue'] ?? '']: props.size === 'compact',
          }}
        >
          {props.value}
        </strong>
        <Show when={tag.present()}>{tag.content()}</Show>
      </span>
      <Show when={props.progress !== undefined}>
        <div class={statStyles['statProgress']}>
          <ProgressBar
            size="sm"
            progress={props.progress}
            accessibleLabel={props.progressLabel}
          />
        </div>
      </Show>
      <Show when={props.detail}>
        <span class="text textFootnote">{props.detail}</span>
      </Show>
    </div>
  );
}
