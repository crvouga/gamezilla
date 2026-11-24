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
import styles from './game-result-dialog.module.css';

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
  return (
    <ResponsiveSurface
      visible={props.state.open()}
      onClose={() => props.state.close()}
      title={t`Game over`}
      size="small"
      closeDataSet={{ testid: 'game-result-close' }}
      dataSet={{ component: 'GameResultDialog' }}
    >
      <div class={styles['body']}>
        {props.outcome}
        {props.alerts}
        <div class={styles['actions']}>{props.actions}</div>
        {props.footer}
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
