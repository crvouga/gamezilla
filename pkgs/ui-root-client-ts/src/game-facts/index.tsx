/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import styles from './game-facts.module.css';

/**
 * `GameFacts` + `GameFact` -- a game's settings as one quiet line of words
 * (`Unrated · Untimed`, `Rated · 5+0`): plain secondary text with a dot
 * between facts, never a filled pill, so nothing about it looks pressable.
 * The same line sits beside a game's title and above a search's command,
 * so a setting reads the same wherever it is said.
 *
 * @example
 * ```tsx
 * <GameFacts>
 *   <GameFact label="Unrated" />
 *   <GameFact label="Untimed" />
 * </GameFacts>
 * ```
 */
export function GameFacts(props: {
  children: JSX.Element;
  testId?: string | undefined;
  dataSet?: ComponentDataSet | undefined;
}): JSX.Element {
  return (
    <span
      class={styles['facts']}
      data-testid={props.testId}
      {...dataAttrs({ component: 'GameFacts', ...props.dataSet })}
    >
      {props.children}
    </span>
  );
}

/** One fact in a `GameFacts` line. */
export function GameFact(props: {
  label: JSX.Element;
  testId?: string | undefined;
}): JSX.Element {
  return (
    <span
      class={`text textFootnote ${styles['fact']}`}
      data-testid={props.testId}
      {...dataAttrs({ component: 'GameFact' })}
    >
      {props.label}
    </span>
  );
}
