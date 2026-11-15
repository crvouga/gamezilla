/** @jsxImportSource solid-js */

import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import {
  createEffect,
  createSignal,
  type JSX,
  on,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { Button } from '../button/index';
import styles from './bubble-clamp.module.css';

export type BubbleClamp = {
  ref: (element: HTMLParagraphElement) => void;
  /** The words' class while clamped, and the line count it reads. */
  clampClass: () => string | undefined;
  style: () => JSX.CSSProperties;
  overflowing: () => boolean;
  expanded: () => boolean;
  toggle: () => void;
};

/**
 * Clamps a bubble's words to `lines()` lines until expanded, and knows
 * whether they overflow it (measured as the words or the bubble's width
 * change). New words start clamped again.
 */
export function createBubbleClamp(
  text: () => string,
  lines: () => number | undefined
): BubbleClamp {
  const [expanded, setExpanded] = createSignal(false);
  const [overflowing, setOverflowing] = createSignal(false);
  let element: HTMLParagraphElement | undefined;
  const measure = (): void => {
    if (element === undefined || lines() === undefined || expanded()) return;
    setOverflowing(element.scrollHeight > element.clientHeight + 1);
  };
  createEffect(
    on(text, () => {
      setExpanded(false);
      measure();
    })
  );
  onMount(() => {
    if (element === undefined || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    onCleanup(() => observer.disconnect());
  });
  return {
    ref: (node) => {
      element = node;
    },
    clampClass: () =>
      lines() === undefined || expanded() ? undefined : styles['clamped'],
    style: () => {
      const count = lines();
      if (count === undefined || expanded()) return {};
      return { '--bubble-lines': String(count) };
    },
    overflowing,
    expanded,
    toggle: () => setExpanded((value) => !value),
  };
}

/** The bubble's More / Less toggle, shown only when its words overflow. */
export function BubbleMore(props: { clamp: BubbleClamp }): JSX.Element {
  return (
    <Show when={props.clamp.overflowing()}>
      <div
        class={`box flex-row ${styles['more']}`}
        data-component="SpeechBubbleMore"
      >
        <Button
          title={
            <Show when={props.clamp.expanded()} fallback={<Trans>More</Trans>}>
              <Trans>Less</Trans>
            </Show>
          }
          intent="neutral"
          variant="ghost"
          size="sm"
          aria-expanded={props.clamp.expanded()}
          aria-label={
            props.clamp.expanded()
              ? t`Less of this message`
              : t`More of this message`
          }
          onClick={() => props.clamp.toggle()}
        />
      </div>
    </Show>
  );
}
