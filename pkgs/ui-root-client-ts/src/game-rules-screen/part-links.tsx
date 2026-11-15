/** @jsxImportSource solid-js */

import {
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';
import { VisuallyHidden } from '../visually-hidden/index';
import styles from './game-rules-screen.module.css';

/** One part a link leads to. */
export type PartLink = { key: string; title: JSX.Element };

export function partId(screenId: string, key: string): string {
  return `${screenId}-part-${key}`;
}

/** Bring a part into view and the keyboard to its heading. */
function openPart(screenId: string, key: string): void {
  const part = document.getElementById(partId(screenId, key));
  part?.scrollIntoView({ block: 'start' });
  part?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
}

/** The nearest ancestor that scrolls vertically: the screen's own body. */
function scrollerOf(element: HTMLElement): HTMLElement | null {
  let at = element.parentElement;
  while (at !== null) {
    if (/(auto|scroll)/.test(getComputedStyle(at).overflowY)) return at;
    at = at.parentElement;
  }
  return null;
}

/**
 * The part being read: the first whose end has not yet passed under the
 * held row, or the first part while the layout says nothing.
 */
function currentPart(
  screenId: string,
  parts: readonly PartLink[],
  edge: number
): string | undefined {
  for (const part of parts) {
    const element = document.getElementById(partId(screenId, part.key));
    if (element !== null && element.getBoundingClientRect().bottom > edge + 8)
      return part.key;
  }
  return parts[0]?.key;
}

/**
 * The links to each part of the rules, as one row held at the top while
 * the rules scroll: the part being read marked (`aria-current`) and kept in
 * view, the row's ends faded and stepped by arrows when the parts outrun
 * it, and every link one Tab stop that brings its part into view.
 */
export function PartLinks(props: {
  screenId: string;
  label: JSX.Element;
  parts: readonly PartLink[];
}): JSX.Element {
  let nav: HTMLElement | undefined;
  let row: HTMLOListElement | undefined;
  const [current, setCurrent] = createSignal<string | undefined>();
  const [overflow, setOverflow] = createSignal({ start: false, end: false });
  const measure = (): void => {
    if (nav === undefined || row === undefined) return;
    const key = currentPart(
      props.screenId,
      props.parts,
      nav.getBoundingClientRect().bottom
    );
    if (key !== current()) {
      setCurrent(key);
      row
        .querySelector<HTMLElement>(`[data-part="${key}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    setOverflow({
      start: row.scrollLeft > 1,
      end: row.scrollLeft + row.clientWidth < row.scrollWidth - 1,
    });
  };
  onMount(() => {
    const scroller = nav === undefined ? null : scrollerOf(nav);
    scroller?.addEventListener('scroll', measure, { passive: true });
    row?.addEventListener('scroll', measure, { passive: true });
    measure();
    onCleanup(() => {
      scroller?.removeEventListener('scroll', measure);
      row?.removeEventListener('scroll', measure);
    });
  });
  const step = (direction: 1 | -1): void =>
    row?.scrollBy({ left: direction * row.clientWidth * 0.8 });
  return (
    <nav
      ref={nav}
      class={styles['parts']}
      aria-labelledby={`${props.screenId}-parts`}
      data-overflow-start={overflow().start ? '' : undefined}
      data-overflow-end={overflow().end ? '' : undefined}
    >
      <VisuallyHidden id={`${props.screenId}-parts`}>
        {props.label}
      </VisuallyHidden>
      {/* Pointer conveniences only: every link is reached by Tab, and the
          focused one slides into view. */}
      <Show when={overflow().start}>
        <button
          type="button"
          class={`${styles['partStep']} clickable`}
          data-side="start"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => step(-1)}
        >
          <ChevronLeftIcon size={16} />
        </button>
      </Show>
      <ol ref={row} class={styles['partLinks']}>
        <For each={props.parts}>
          {(part, index) => (
            <li>
              <button
                type="button"
                class={`${styles['partLink']} clickable text textCaption`}
                data-part={part.key}
                aria-current={current() === part.key ? 'true' : undefined}
                onClick={() => openPart(props.screenId, part.key)}
              >
                {index() + 1}. {part.title}
              </button>
            </li>
          )}
        </For>
      </ol>
      <Show when={overflow().end}>
        <button
          type="button"
          class={`${styles['partStep']} clickable`}
          data-side="end"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => step(1)}
        >
          <ChevronRightIcon size={16} />
        </button>
      </Show>
    </nav>
  );
}
