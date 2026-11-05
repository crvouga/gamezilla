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
   * A quiet control at the title's far end: a way out of the section
   * (`History and stats`), kept apart from the commands in its footer.
   */
  trailing?: JSX.Element;
  /**
   * Beside a wide board (`GameLayout`), the section stretches to the foot
   * of its column, so the board and the rail end on one line; a move table
   * in it takes the extra room and scrolls inside. Phones keep its own
   * height.
   */
  fill?: boolean | undefined;
  /**
   * Beside the body, inside the card: a picture of what the section sets
   * up (a game's board preview), at a thumbnail's size, so the card and
   * its picture read as one unit instead of a stray tile beside it.
   */
  media?: JSX.Element | undefined;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  const id = createUniqueId();
  const description = createScreenSlot(() => props.description);
  const footer = createScreenSlot(() => props.footer);
  const trailing = createScreenSlot(() => props.trailing);
  const media = createScreenSlot(() => props.media);
  return (
    <section
      class={`${styles['section']} rounded-card border border-border bg-surface`}
      aria-labelledby={id}
      data-fill={props.fill === true}
      data-section-media={media.present()}
      {...dataAttrs({ component: 'GameSection', ...props.dataSet })}
    >
      <div class="box gap-1">
        <div class="box flex-row items-center justify-between gap-2 min-w-0">
          <h2 id={id} class="text textNavigationTitle min-w-0">
            {props.title}
          </h2>
          <Show when={trailing.present()}>
            <div class="box flex-row items-center shrink-0">
              {trailing.content()}
            </div>
          </Show>
        </div>
        <Show when={description.present()}>
          <p class="text textBody text-text-secondary">
            {description.content()}
          </p>
        </Show>
      </div>
      <Show when={media.present()} fallback={props.children}>
        <div class={styles['sectionSplit']}>
          <div class={styles['sectionBody']}>{props.children}</div>
          <div class={styles['sectionMedia']}>{media.content()}</div>
        </div>
      </Show>
      <Show when={footer.present()}>
        <div class={styles['sectionFooter']}>{footer.content()}</div>
      </Show>
    </section>
  );
}

/**
 * The game's commands beside a wide board (offer a draw, resign), in a
 * card of their own pinned to the foot of the rail, so they end on the
 * board's line and never read as part of the record above them. Phones
 * keep their commands under the board and never use it.
 */
export function GameRailFoot(props: {
  children: JSX.Element;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  const content = createScreenSlot(() => props.children);
  return (
    <Show when={content.present()}>
      <div
        class={`${styles['railFoot']} rounded-card border border-border bg-surface`}
        {...dataAttrs({ component: 'GameRailFoot', ...props.dataSet })}
      >
        {content.content()}
      </div>
    </Show>
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
