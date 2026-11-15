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
import { observeElementResize } from '../observe-element-resize';
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
 * The part being read: the one that fills most of the view below the held
 * row (a jump's part, once it lands; the part on screen as the rules
 * scroll); the first before any has passed under the row, or while the
 * layout says nothing.
 */
function currentPart(
  screenId: string,
  keys: readonly string[],
  edge: number
): string | undefined {
  const bottom = window.innerHeight;
  // Before the rules start scrolling under the row, their first part.
  const first = document
    .getElementById(partId(screenId, keys[0] ?? ''))
    ?.getBoundingClientRect();
  if (first !== undefined && first.height > 0 && first.top >= edge)
    return keys[0];
  let current = keys[0];
  let most = 0;
  for (const key of keys) {
    const rect = document
      .getElementById(partId(screenId, key))
      ?.getBoundingClientRect();
    if (rect === undefined) continue;
    const seen = Math.min(rect.bottom, bottom) - Math.max(rect.top, edge);
    if (seen > most) {
      most = seen;
      current = key;
    }
  }
  return current;
}

/**
 * An arrow that steps the row toward one end. A pointer convenience only:
 * every link is reached by Tab, and the focused one slides into view.
 */
function PartStep(props: {
  side: 'start' | 'end';
  onStep: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      class={`${styles['partStep']} clickable`}
      data-side={props.side}
      tabIndex={-1}
      aria-hidden="true"
      onClick={() => props.onStep()}
    >
      <Show
        when={props.side === 'start'}
        fallback={<ChevronRightIcon size={16} />}
      >
        <ChevronLeftIcon size={16} />
      </Show>
    </button>
  );
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
    // The row's links take their words after the first paint, and fonts
    // settle later still: whether they outrun the row is measured as they
    // change size, so its arrow shows from the first display.
    const stops = [...(row?.children ?? [])].map((link) =>
      observeElementResize(link, measure)
    );
    measure();
    onCleanup(() => {
      document.removeEventListener('scroll', measure, options);
      window.removeEventListener('resize', measure);
      for (const stop of stops) stop();
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
      <Show when={overflow().start}>
        <PartStep side="start" onStep={() => step(-1)} />
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
        <PartStep side="end" onStep={() => step(1)} />
      </Show>
    </nav>
  );
}
