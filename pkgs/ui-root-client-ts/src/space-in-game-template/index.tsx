/** @jsxImportSource @solidjs/web */

import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { createSignal, Show } from 'solid-js';
import { Button } from '../button/index';
import { ResponsiveSurface } from '../responsive-surface/index';
import { spaceDataSet } from '../space-data-set';
import { type SpaceScreenChrome, SpaceShell } from '../space-shell/index';
import type {
  SpaceGame,
  SpaceGamePlay,
  SpaceGameResult,
  SpaceInGameAside,
  SpacePerson,
  SpaceRole,
} from '../space-types';
import { SpaceActionBar } from './space-action-bar';
import styles from './space-in-game-template.module.css';

export {
  SPACE_ACTION_BAR_MAX,
  SpaceActionBar,
  type SpaceActionBarProps,
  spaceActionBarSplit,
} from './space-action-bar';

export type SpaceInGameTemplateProps = SpaceScreenChrome & {
  /** The game being played: its `play` fills the stage. */
  game: SpaceGame & { play: SpaceGamePlay };
  role: SpaceRole;
  /** Everyone in the space; the game gives each a color, turn and data. */
  people: readonly SpacePerson[];
  /**
   * The game is over: its outcome replaces the status line and its actions
   * (Rematch, Back to games) replace the game's; the board stays.
   */
  result?: SpaceGameResult | undefined;
  /** The status line's opener for the move list or the game's commands. */
  aside?: SpaceInGameAside | undefined;
  /** The action bar's More, when there are more than three actions. */
  moreTestId?: string | undefined;
  dataSet?: ComponentDataSet | undefined;
};

function AsideOpener(props: { aside: SpaceInGameAside }): JSX.Element {
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <Button
        title={props.aside.label}
        intent="neutral"
        variant="ghost"
        size="sm"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        dataSet={spaceDataSet({ action: 'aside' }, props.aside.testId)}
      />
      <ResponsiveSurface
        visible={open()}
        onClose={() => setOpen(false)}
        title={props.aside.label}
        dataSet={{ component: 'SpaceInGameAside' }}
      >
        <Show when={open()}>{props.aside.content()}</Show>
      </ResponsiveSurface>
    </>
  );
}

function StatusLine(props: {
  play: SpaceGamePlay;
  result: SpaceGameResult | undefined;
  aside: SpaceInGameAside | undefined;
}): JSX.Element {
  const detail = () => props.result?.detail ?? props.play.detail;
  return (
    <div
      class={styles['status']}
      data-result={props.result === undefined ? undefined : 'true'}
    >
      <h2 class={`text textHeading ${styles['headline']}`} aria-live="polite">
        {props.result?.status ?? props.play.status}
      </h2>
      <Show when={detail()}>
        {(text) => (
          <span class={`text textCaption ${styles['detail']}`}>{text()}</span>
        )}
      </Show>
      <Show when={props.aside}>
        {(aside) => <AsideOpener aside={aside()} />}
      </Show>
    </div>
  );
}

function InGameStage(props: SpaceInGameTemplateProps): JSX.Element {
  const { t } = useLingui();
  const play = () => props.game.play;
  return (
    <div class={styles['stage']}>
      <StatusLine play={play()} result={props.result} aside={props.aside} />
      <div class={styles['board']} data-space-board="true">
        {play().board}
      </div>
      <SpaceActionBar
        actions={props.result?.actions ?? play().actions}
        waiting={
          props.result === undefined ? play().waiting : t`The game is over`
        }
        moreTestId={props.moreTestId}
      />
    </div>
  );
}

/**
 * `SpaceInGameTemplate` -- a space while a game is played, with the game
 * as a parameter. The game supplies everything in `SpaceGame.play`: the
 * slim status line, the whole board, the action bar's actions for this
 * moment (or what the viewer waits for), each person's color, turn and
 * one number, and the actions it adds to each person's menu. The template
 * supplies the frame: the three rows, the board edge to edge in the stage,
 * the fixed action bar, and the people row with player-color rings and the
 * turn badge. Invite is hidden while a game runs.
 *
 * The session adds the `result` once the game is over (its status and next
 * actions in place of the game's), and an `aside` the status line opens
 * (the move list, commands).
 */
export function SpaceInGameTemplate(
  props: SpaceInGameTemplateProps
): JSX.Element {
  return (
    <SpaceShell
      spaceName={props.spaceName}
      title={props.title ?? props.game.name}
      role={props.role}
      onBack={props.onBack}
      backLabel={props.backLabel}
      onMembers={props.onMembers}
      onRename={props.onRename}
      onMinimize={props.onMinimize}
      onInvite={props.onInvite}
      onLeave={props.onLeave}
      onEnd={props.onEnd}
      notice={props.notice}
      testIds={props.testIds}
      stage="fixed"
      dataSet={{
        component: 'SpaceInGameTemplate',
        game: props.game.key,
        ...props.dataSet,
      }}
    >
      <InGameStage {...props} />
    </SpaceShell>
  );
}
