/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import styles from './key-hints.module.css';

export type KeyHint = {
  /** The keys, each drawn as a key cap (`↵`, `Esc`). */
  readonly keys: readonly string[];
  /** What they do, one or two words (`start a path`). */
  readonly label: string;
};

export type KeyHintsProps = {
  /** The pointer's way, said first in words (`Drag from a number to its match.`). */
  readonly lead?: JSX.Element | undefined;
  readonly hints: readonly KeyHint[];
  readonly testId?: string | undefined;
  readonly dataSet?: ComponentDataSet | undefined;
};

/**
 * `KeyHints` -- how to play by keyboard as one quiet line of key caps,
 * each beside what it does, after the pointer's way in words: a compact
 * hint under a board instead of a paragraph about keys.
 */
export function KeyHints(props: KeyHintsProps): JSX.Element {
  return (
    <p
      class={`text textCaption ${styles['hints']}`}
      data-testid={props.testId}
      {...dataAttrs({ component: 'KeyHints', ...props.dataSet })}
    >
      <Show when={props.lead}>
        <span class={styles['lead']}>{props.lead}</span>
      </Show>
      <For each={props.hints}>
        {(hint) => (
          <span class={styles['hint']}>
            <For each={hint.keys}>
              {(key) => <kbd class={styles['key']}>{key}</kbd>}
            </For>
            <span>{hint.label}</span>
          </span>
        )}
      </For>
    </p>
  );
}
