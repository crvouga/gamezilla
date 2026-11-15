/** @jsxImportSource solid-js */

import {
  createMemo,
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
export type PartLink = { key: string };

export function partId(screenId: string, key: string): string {
  return `${screenId}-part-${key}`;
}

/** Bring a part into view and the keyboard to its heading. */
function openPart(screenId: string, key: string): void {
  const part = document.getElementById(partId(screenId, key));
  part?.scrollIntoView({ block: 'start' });
  part?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
}

/**
 * A part's name as its heading reads, number aside. The link repeats the
 * heading's words rather than its element: one element is never drawn in
 * two places.
 */
function partName(screenId: string, key: string): string {
  const heading = document
    .getElementById(partId(screenId, key))
    ?.querySelector('h2');
  if (heading === null || heading === undefined) return '';
  return [...heading.childNodes]
    .filter(
      (node) =>
        !(
          node instanceof HTMLElement &&
          node.getAttribute('aria-hidden') === 'true'
        )
    )
    .map((node) => node.textContent ?? '')
    .join('')
    .trim();
}

/**
 * The part being read: the first whose end has not yet passed under the
 * held row, or the first part while the layout says nothing.
 */
function currentPart(
  screenId: string,
  keys: readonly string[],
  edge: number
): string | undefined {
  for (const key of keys) {
    const element = document.getElementById(partId(screenId, key));
    if (element !== null && element.getBoundingClientRect().bottom > edge + 8)
      return key;
  }
  return keys[0];
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
  // The parts' keys, read once per change of parts: a scroll handler never
  // reads the caller's props, which may build their elements anew.
  const keys = createMemo(() => props.parts.map((part) => part.key));
  const [current, setCurrent] = createSignal<string | undefined>();
  const [names, setNames] = createSignal<Readonly<Record<string, string>>>({});
  const [overflow, setOverflow] = createSignal({ start: false, end: false });
  const measure = (): void => {
    if (nav === undefined || row === undefined) return;
    const key = currentPart(
      props.screenId,
      keys(),
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
    setNames(
      Object.fromEntries(
        keys().map((key) => [key, partName(props.screenId, key)])
      )
    );
    // Whichever box scrolls the rules (the screen's body, or the page),
    // its scroll reaches the document in the capture phase.
    const options = { capture: true, passive: true } as const;
    document.addEventListener('scroll', measure, options);
    window.addEventListener('resize', measure, { passive: true });
    measure();
    onCleanup(() => {
      document.removeEventListener('scroll', measure, options);
      window.removeEventListener('resize', measure);
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
        <For each={keys()}>
          {(key, index) => (
            <li>
              <button
                type="button"
                class={`${styles['partLink']} clickable text textCaption`}
                data-part={key}
                aria-current={current() === key ? 'true' : undefined}
                onClick={() => openPart(props.screenId, key)}
              >
                {index() + 1}. {names()[key]}
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
