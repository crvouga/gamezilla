/** @jsxImportSource @solidjs/web */
import type { JSX } from '@solidjs/web';
import { Match, Show, Switch } from 'solid-js';
import styles from './warehouse.module.css';

type Piece = 'actor' | 'object' | 'settled';

function Worker(): JSX.Element {
  return (
    <>
      <path class={styles['uniform']} d="M4 40v-5q0-10 16-10t16 10v5z" />
      <path class={styles['face']} d="M9 16h22v5a11 11 0 0 1-22 0z" />
      <path
        class={styles['helmet']}
        d="M6 16q0-12 11-13h6q11 1 11 13l2 2v2H4v-2z"
      />
      <path class={styles['line']} d="M17 4v7m6-7v7M6 16h28" />
      <g class={styles['ink']}>
        <circle cx="15" cy="23" r="1.6" />
        <circle cx="25" cy="23" r="1.6" />
      </g>
      <path class={styles['line']} d="M17 27q3 3 6 0" />
      <path class={styles['straps']} d="m10 32 3 8m17-8-3 8" />
    </>
  );
}

function Cargo(props: { readonly delivered: boolean }): JSX.Element {
  return (
    <>
      <path class={styles['wood']} d="M0 22h40v18H0z" />
      <path class={styles['grain']} d="M4 13h32M4 25h32" />
      <path class={styles['brace']} d="M0 32 32 0h8v8L8 40H0z" />
      <g class={styles['ink']}>
        <circle cx="6" cy="34" r="2" />
        <circle cx="34" cy="6" r="2" />
      </g>
      <Show when={props.delivered}>
        <circle class={styles['ink']} cx="25" cy="25" r="14" />
        <path class={styles['check']} d="m17 25 5 5 11-12" />
      </Show>
    </>
  );
}

function WarehousePiece(props: { readonly tone: Piece }): JSX.Element {
  return (
    <svg class={styles['piece']} viewBox="0 0 40 40" aria-hidden="true">
      <Switch>
        <Match when={props.tone === 'actor'}>
          <Worker />
        </Match>
        <Match when={props.tone !== 'actor'}>
          <Cargo delivered={props.tone === 'settled'} />
        </Match>
      </Switch>
    </svg>
  );
}

export const warehouseArt = {
  actor: () => <WarehousePiece tone="actor" />,
  object: () => <WarehousePiece tone="object" />,
  settled: () => <WarehousePiece tone="settled" />,
} satisfies Record<Piece, () => JSX.Element>;
