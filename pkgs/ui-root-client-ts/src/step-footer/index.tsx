/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, type JSX } from 'solid-js';
import styles from './step-footer.module.css';

export type StepFooterProps = {
  /** What the step's actions finish (`3 · Check and publish`); names it. */
  title: JSX.Element;
  /**
   * Where the step stands and its actions: a line of status text, then the
   * actions in one row (the one filled next step among them).
   */
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `StepFooter` -- the step that finishes a long screen, as its last section.
 *
 * Place it last in the screen's body. It scrolls with everything above it
 * behind a full-width hairline, so it never covers what comes before it
 * and is never cut off by the window: at the end of the scroll it is
 * wholly in view. Its title names it as a region; under the title, the
 * step's status and actions.
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
