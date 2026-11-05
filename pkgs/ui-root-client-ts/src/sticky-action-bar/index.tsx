/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, type JSX, Show } from 'solid-js';
import { createScreenSlot } from '../screen-slot';
import styles from './sticky-action-bar.module.css';

export type StickyActionBarProps = {
  /** What the bar's actions finish (`Check and publish`); names the bar. */
  title: JSX.Element;
  /** One short line on what happens next; hidden on a phone. */
  description?: JSX.Element | undefined;
  /** The actions, the one filled next step last. */
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `StickyActionBar` -- the step that finishes a long screen, kept in view.
 *
 * A raised card at the end of the screen's column that sticks to the
 * bottom of the viewport while anything above it scrolls, so the next step
 * (validate, then publish) is always one press away from what it acts on.
 * Its title names it as a region; its actions sit at the end edge and wrap
 * under the title when the line is short. Place it last in a column; it
 * takes its own room in the flow, so nothing ever scrolls under it for good.
 */
export function StickyActionBar(props: StickyActionBarProps): JSX.Element {
  const id = createUniqueId();
  const description = createScreenSlot(() => props.description);
  return (
    <section
      class={styles['bar']}
      aria-labelledby={id}
      {...dataAttrs({ component: 'StickyActionBar', ...props.dataSet })}
    >
      <div class={styles['heading']}>
        <h2 id={id} class="text textNavigationTitle">
          {props.title}
        </h2>
        <Show when={description.present()}>
          <p class={`text textCaption text-text-secondary ${styles['about']}`}>
            {description.content()}
          </p>
        </Show>
      </div>
      <div class={styles['actions']}>{props.children}</div>
    </section>
  );
}
