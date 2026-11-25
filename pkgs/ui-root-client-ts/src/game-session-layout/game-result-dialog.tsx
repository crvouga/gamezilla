/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  type Accessor,
  createEffect,
  createSignal,
  type JSX,
  on,
} from 'solid-js';
import { Button } from '../button/index';
import { ResponsiveSurface } from '../responsive-surface/index';
import { useLayoutMode } from '../use-layout-mode';
import styles from './game-result-dialog.module.css';

/** Where the phone card starts (under the top bar) and the gap it keeps over the board. */
const CARD_TOP_PX = 56 + 8;
/** The least a capped card keeps, so its commands always show. */
const MIN_CARD_PX = 240;

/** Whether the outcome's dialog is open, and the ways to close and reopen it. */
export type GameResultDialogState = {
  readonly open: Accessor<boolean>;
  readonly close: () => void;
  readonly reopen: () => void;
};

/**
 * The outcome dialog's state: open as soon as a game ends (`present`), once
 * per ending; closed, it stays closed until the person asks for it again
 * or the next game ends.
 */
export function createGameResultDialog(
  present: Accessor<boolean>
): GameResultDialogState {
  const [dismissed, setDismissed] = createSignal(false);
  createEffect(
    on(present, (now) => {
      if (!now) setDismissed(false);
    })
  );
  return {
    open: () => present() && !dismissed(),
    close: () => setDismissed(true),
    reopen: () => setDismissed(false),
  };
}

/**
 * `GameResultDialog` -- how a game ended, as a dialog over the final board
 * (a bottom sheet on a phone): the outcome card and what to do next
 * together, so the end of a game is an event and never a strip squeezed in
 * beside the board. Closing it shows the whole final position; the
 * commands return to the bar and `Show result` opens it again. The board
 * under it never moves.
 */
export function GameResultDialog(props: {
  readonly state: GameResultDialogState;
  /** The outcome card (`GameResultCard`). */
  readonly outcome: JSX.Element;
  /** The session's alerts (a refused rematch), said over the commands. */
  readonly alerts?: JSX.Element | undefined;
  /** The next actions, moved here from the bar while the dialog is open. */
  readonly actions: JSX.Element;
  /** Quieter ways on (other options, ratings), under the commands. */
  readonly footer?: JSX.Element | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const mode = useLayoutMode();
  // On a phone the card ends above the board: its height is capped at the
  // room between the top bar and the board's top edge (read as it opens),
  // and a longer card (scores, a notice) scrolls inside it instead.
  const [room, setRoom] = createSignal<number | undefined>(undefined);
  createEffect(
    on(
      () => props.state.open(),
      (open) => {
        if (!open || mode() !== 'compact') {
          setRoom(undefined);
          return;
        }
        const board = document.querySelector('[data-game-board]');
        const top = board?.getBoundingClientRect().top;
        setRoom(
          top === undefined
            ? undefined
            : Math.max(MIN_CARD_PX, top - CARD_TOP_PX)
        );
      }
    )
  );
  return (
    <ResponsiveSurface
      visible={props.state.open()}
      maxHeight={room()}
      onClose={() => props.state.close()}
      // Named "Game over" for a listener; on screen the outcome's own word
      // (Victory, Defeat, Draw) leads the card, with no title row over it,
      // so the card stays short over the final board.
      label={t`Game over`}
      // A centred card, docked over the game's info at the top on a phone,
      // never a bottom sheet over the board: the final position stays in
      // view under the result.
      presentation="modal"
      size="small"
      closeDataSet={{ testid: 'game-result-close' }}
      dataSet={{ component: 'GameResultDialog' }}
    >
      <div class={styles['body']}>
        {props.outcome}
        <div class={styles['alerts']}>{props.alerts}</div>
        <div class={styles['actions']}>{props.actions}</div>
        <div class={styles['footer']}>{props.footer}</div>
      </div>
    </ResponsiveSurface>
  );
}

/** The way back to the outcome once its dialog is closed. */
export function ShowResultButton(props: {
  readonly state: GameResultDialogState;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <span {...dataAttrs({ component: 'GameShowResult' })}>
      <Button
        title={t`Show result`}
        size="sm"
        variant="ghost"
        onClick={() => props.state.reopen()}
        dataSet={{ testid: 'game-show-result' }}
      />
    </span>
  );
}
