/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, type JSX } from 'solid-js';
import styles from './step-footer.module.css';

export type StepFooterProps = {
  /** What the footer's actions finish (`3 · Check and publish`); names it. */
  title: JSX.Element;
  /**
   * Where the step stands and its actions, as one row: a line of status
   * text at the start, the actions (the one filled next step last) at the
   * end, wrapping under the status when the line is short.
   */
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `StepFooter` -- the step that finishes a long screen, in the screen's
 * footer.
 *
 * Place it in a screen's `footer` slot (`EmbeddedScreen`, `GameScreen`):
 * the footer is a strip of its own under the scroll area, so the step is
 * always one press away and nothing ever scrolls beneath it. Its title
 * names it as a region; under the title, the step's status and actions
 * share one row.
 */
export function StepFooter(props: StepFooterProps): JSX.Element {
  const id = createUniqueId();
  return (
    <section
      class={styles['footer']}
      aria-labelledby={id}
      {...dataAttrs({ component: 'StepFooter', ...props.dataSet })}
    >
      <h2 id={id} class="text textNavigationTitle">
        {props.title}
      </h2>
      {props.children}
    </section>
  );
}
