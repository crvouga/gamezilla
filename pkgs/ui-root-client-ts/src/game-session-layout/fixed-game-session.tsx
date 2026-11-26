import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { children, createSignal, Show } from 'solid-js';
import { Button } from '../button/index';
import { GameActions } from '../game-section/index';
import { ResponsiveSurface } from '../responsive-surface/index';
import { createScreenSlot } from '../screen-slot';
import { ToastStack } from '../toast-stack/index';
import styles from './fixed-stage.module.css';
import {
  createGameResultDialog,
  GameResultDialog,
  ShowResultButton,
} from './game-result-dialog';

export type GameSessionAllMoves = {
  readonly label: JSX.Element;
  readonly onPress: () => void;
  readonly testId: string;
};

/** The board renders the information between its players and its playing surface. */
export type FixedGameSessionProps = {
  readonly children: (information: JSX.Element) => JSX.Element;
  readonly status?: JSX.Element;
  readonly history?: JSX.Element;
  readonly allMoves?: GameSessionAllMoves | undefined;
  readonly actions?: JSX.Element;
  readonly notices?: JSX.Element;
  readonly sheet?: JSX.Element;
  readonly sheetFooter?: JSX.Element;
  readonly dataSet?: ComponentDataSet | undefined;
};

function HistoryStrip(props: FixedGameSessionProps): JSX.Element {
  return (
    <div
      class={styles['strip']}
      data-game-slot="history"
      data-component="GameStageStrip"
    >
      {props.history}
      <Show when={props.allMoves}>
        {(all) => (
          <Button
            title={all().label}
            variant="ghost"
            intent="primary"
            size="sm"
            onClick={() => all().onPress()}
            dataSet={{ testid: all().testId }}
          />
        )}
      </Show>
    </div>
  );
}

export function FixedGameSession(props: FixedGameSessionProps): JSX.Element {
  const outcome = createScreenSlot(() => props.sheet);
  const dialog = createGameResultDialog(outcome.present);
  const actions = children(() => props.actions);
  const alerts = children(() => props.notices);
  return (
    <div
      class={styles['fixed']}
      data-game-fixed="true"
      {...dataAttrs({ component: 'GameSessionLayout', ...props.dataSet })}
    >
      <div class={styles['stage']} data-game-slot="stage">
        {props.children(
          <div class={styles['information']}>
            <div class={styles['status']} data-component="GameStageStatus">
              {props.status}
              <Show when={outcome.present() && !dialog.open()}>
                <ShowResultButton state={dialog} />
              </Show>
            </div>
            <HistoryStrip {...props} />
          </div>
        )}
      </div>
      <div
        class={styles['commands']}
        data-game-slot="controls"
        data-component="GameControls"
      >
        <Show when={!dialog.open()}>
          <GameActions>{actions()}</GameActions>
        </Show>
      </div>
      <Show when={outcome.present()}>
        <GameResultDialog
          state={dialog}
          outcome={outcome.content()}
          footer={props.sheetFooter}
          alerts={<Show when={dialog.open()}>{alerts()}</Show>}
          actions={
            <Show when={dialog.open()}>
              <GameActions>{actions()}</GameActions>
            </Show>
          }
        />
      </Show>
      <Show when={!dialog.open()}>
        <ToastStack
          placement="above-commands"
          dataSet={{ component: 'GameSessionNotices' }}
        >
          {alerts()}
        </ToastStack>
      </Show>
    </div>
  );
}

/** Review tools and records can be opened without resizing the playing surface. */
export function StageDetails(props: {
  label: string;
  testId: string;
  children: JSX.Element;
}): JSX.Element {
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <Button
        title={props.label}
        size="sm"
        variant="outline"
        intent="neutral"
        aria-haspopup="dialog"
        aria-expanded={open()}
        dataSet={{ testid: props.testId }}
        onClick={() => setOpen(true)}
      />
      <ResponsiveSurface
        visible={open()}
        title={props.label}
        onClose={() => setOpen(false)}
      >
        {props.children}
      </ResponsiveSurface>
    </>
  );
}
