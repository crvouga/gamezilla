/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, type JSX, Show } from 'solid-js';
import { ChevronRightIcon } from '../icons';
import styles from './preview-card-grid.module.css';

export type PreviewCardGridProps = {
  /** The section's label over its cards (`Continue playing`). */
  title?: JSX.Element | undefined;
  /** One quiet line under the cards, said once for all of them. */
  footer?: JSX.Element | undefined;
  /** `PreviewCard`s. */
  children: JSX.Element;
  /**
   * `cards` (default): wide, a grid of cards, each picture across its card.
   * `rows`: compact at every width, for lists picked up where they were
   * left (Continue): wide, two columns of row cards, each a small picture
   * beside its title, so the next section stays in view.
   */
  layout?: 'cards' | 'rows' | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `PreviewCardGrid` -- a section of things told apart by their picture (a
 * library of puzzle boards), sized by its own width.
 *
 * Where there is room (640px and up) it is a grid of cards, each its
 * picture across the card's width over its title and facts, so a wide
 * screen fills with what can be opened instead of with one long row per
 * item. Narrower, the same cards are rows in one panel: a 64px picture
 * at the start, the title and facts beside it and a chevron at the end.
 * Titles wrap at every size; they are never cut short.
 */
export function PreviewCardGrid(props: PreviewCardGridProps): JSX.Element {
  const id = createUniqueId();
  return (
    <section
      class={styles['section']}
      aria-labelledby={props.title === undefined ? undefined : id}
      {...dataAttrs({
        component: 'PreviewCardGrid',
        layout: props.layout ?? 'cards',
        ...props.dataSet,
      })}
    >
      <Show when={props.title !== undefined}>
        <h3 id={id} class="text textSectionLabel px-4">
          {props.title}
        </h3>
      </Show>
      <ul class={styles['grid']}>{props.children}</ul>
      <Show when={props.footer !== undefined}>
        <p class="text textCaption px-4">{props.footer}</p>
      </Show>
    </section>
  );
}

export type PreviewCardProps = {
  /**
   * The picture: a `PreviewThumbnail` of size `fill`, which takes the
   * card's picture area (the card's width, or 64px in a row).
   */
  picture: JSX.Element;
  title: JSX.Element;
  /** Chips or a line under the title (kind, difficulty, status). */
  caption?: JSX.Element | undefined;
  /** Where the person stands with it (`2 of 3 solved`), last. */
  meta?: JSX.Element | undefined;
  onClick: () => void;
  'aria-label'?: string | undefined;
  disabled?: boolean | undefined;
  /** Identifiers for the card's button. */
  dataSet?: ComponentDataSet | undefined;
};

/** `PreviewCard` -- one thing in a `PreviewCardGrid`, the whole card a button. */
export function PreviewCard(props: PreviewCardProps): JSX.Element {
  return (
    <li class={styles['item']}>
      <button
        type="button"
        class={`clickable clickableTint ${styles['card']}`}
        aria-label={props['aria-label']}
        disabled={props.disabled === true}
        onClick={() => props.onClick()}
        {...dataAttrs({ component: 'PreviewCard', ...props.dataSet })}
      >
        <span class={styles['picture']}>{props.picture}</span>
        <span class={styles['body']}>
          <span class={`text textBody textRowTitle ${styles['title']}`}>
            {props.title}
          </span>
          <Show when={props.caption}>
            <span class={`text textCaption ${styles['caption']}`}>
              {props.caption}
            </span>
          </Show>
          <Show when={props.meta}>
            <span class={`text textCaption ${styles['meta']}`}>
              {props.meta}
            </span>
          </Show>
        </span>
        <span class={styles['chevron']} aria-hidden="true">
          <ChevronRightIcon size={20} color="icon" />
        </span>
      </button>
    </li>
  );
}
