/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  createSignal,
  createUniqueId,
  type JSX,
  Show,
  untrack,
} from 'solid-js';
import { ChevronDownIcon } from '../icons';
import styles from './disclosure-card.module.css';

export type DisclosureCardProps = {
  /** The card's name (`1 · Details`). */
  title: JSX.Element;
  /** One line on what the card holds, shown while it is closed. */
  summary?: JSX.Element | undefined;
  /** Open on first render (read once): a card that still needs filling in. */
  defaultOpen?: boolean | undefined;
  /** Rendered as the toggle's `data-testid`. */
  toggleTestId?: string | undefined;
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `DisclosureCard` -- a card that keeps settings out of the way of the
 * work they describe.
 *
 * Closed, it is one row: the title, a one-line summary of what it holds
 * and a chevron, the whole row a button (`aria-expanded`). Open, its body
 * follows under the row. Use it for details a person sets once and then
 * works beside (a draft's title and description above its editor), so the
 * work itself is what fills the screen.
 */
export function DisclosureCard(props: DisclosureCardProps): JSX.Element {
  const [open, setOpen] = createSignal(
    untrack(() => props.defaultOpen === true)
  );
  const id = createUniqueId();
  return (
    <section
      class={`${styles['card']} rounded-card border border-border bg-surface`}
      data-open={open()}
      {...dataAttrs({ component: 'DisclosureCard', ...props.dataSet })}
    >
      <button
        type="button"
        class={styles['trigger']}
        aria-expanded={open()}
        aria-controls={id}
        data-testid={props.toggleTestId}
        onClick={() => setOpen(!open())}
      >
        <span class={styles['heading']}>
          <span class="text textNavigationTitle">{props.title}</span>
          <Show when={!open() && props.summary !== undefined}>
            <span class="text textCaption text-text-secondary truncate">
              {props.summary}
            </span>
          </Show>
        </span>
        <span class={styles['chevron']} data-open={open()} aria-hidden="true">
          <ChevronDownIcon size={20} />
        </span>
      </button>
      <Show when={open()}>
        <div id={id} class={styles['body']}>
          {props.children}
        </div>
      </Show>
    </section>
  );
}
