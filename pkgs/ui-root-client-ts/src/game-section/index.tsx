import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, type JSX, Show } from 'solid-js';
import styles from '../game-ui.module.css';
import { createScreenSlot } from '../screen-slot';

/**
 * Named game content section with optional description and footer. Compose game controls in its body; the generated heading labels the section for assistive technology.
 */
export function GameSection(props: {
  title: JSX.Element;
  description?: JSX.Element;
  children: JSX.Element;
  footer?: JSX.Element;
  /**
   * Beside a wide board (`GameLayout`), the section stretches to the foot
   * of its column, so the board and the rail end on one line; a move table
   * in it takes the extra room and scrolls inside. Phones keep its own
   * height.
   */
  fill?: boolean | undefined;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  const id = createUniqueId();
  const description = createScreenSlot(() => props.description);
  const footer = createScreenSlot(() => props.footer);
  return (
    <section
      class={`${styles['section']} rounded-card border border-border bg-surface`}
      aria-labelledby={id}
      data-fill={props.fill === true}
      {...dataAttrs({ component: 'GameSection', ...props.dataSet })}
    >
      <div class="box gap-1">
        <h2 id={id} class="text textNavigationTitle">
          {props.title}
        </h2>
        <Show when={description.present()}>
          <p class="text textBody text-text-secondary">
            {description.content()}
          </p>
        </Show>
      </div>
      {props.children}
      <Show when={footer.present()}>
        <div class={styles['sectionFooter']}>{footer.content()}</div>
      </Show>
    </section>
  );
}

/**
 * A row of game commands, wrapping when the line is short. `share`: the
 * commands split the row evenly, each at most a primary command's width
 * (320px), so one prominent command (Start) and its companion (I'm not
 * ready) read as a pair instead of a stretched bar and a stray link.
 */
export function GameActions(props: {
  children: JSX.Element;
  sizing?: 'content' | 'share' | undefined;
}): JSX.Element {
  const content = createScreenSlot(() => props.children);
  return (
    <Show when={content.present()}>
      <div
        class={styles['actions']}
        data-sizing={props.sizing ?? 'content'}
        {...dataAttrs({ component: 'GameActions' })}
      >
        {content.content()}
      </div>
    </Show>
  );
}
