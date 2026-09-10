/** @jsxImportSource solid-js */
/**
 * `Clickable` -- themed `<button>` host with press feedback.
 *
 * The default `feedback="tint"` mode layers a translucent overlay (theme
 * `interactiveHover` / `interactivePress` tokens) above the children on
 * hover (fine pointers only, via `@media (hover: hover)`) and on press.
 * `:focus-visible` renders a 2px tint ring. Renders a real button so
 * keyboard / screen-reader semantics come for free; use `role` to override.
 */

import { type JSX, splitProps } from 'solid-js';
import { type ComponentDataSet, componentDataAttrs } from '../../component-id';
import { joinClass } from '../box/box';
import styles from '../hosts.module.css';

export type ClickableFeedback = 'tint' | 'opacity' | 'none';

export type ClickableProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'type'
> & {
  /** Visual press feedback. Defaults to `'tint'`. */
  feedback?: ClickableFeedback | undefined;
  /** Button type. Defaults to `button` so forms are never submitted by accident. */
  type?: 'button' | 'submit' | 'reset' | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  children?: JSX.Element | undefined;
};

const FEEDBACK_CLASS: Record<ClickableFeedback, string | undefined> = {
  tint: styles['clickableTint'],
  opacity: styles['clickableOpacity'],
  none: undefined,
};

export function Clickable(props: ClickableProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'feedback',
    'type',
    'dataSet',
    'class',
    'style',
    'children',
  ]);
  return (
    <button
      type={local.type ?? 'button'}
      class={joinClass(
        styles['clickable'],
        FEEDBACK_CLASS[local.feedback ?? 'tint'],
        local.class
      )}
      style={local.style}
      {...componentDataAttrs('Clickable', local.dataSet)}
      {...rest}
    >
      {local.children}
    </button>
  );
}
