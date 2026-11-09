import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { GameLayout } from '../game-screen/index';
import { GameActions } from '../game-section/index';
import { createScreenSlot } from '../screen-slot';
import styles from './game-session-layout.module.css';

export type GameSessionLayoutProps = {
  /** The title row: a `GameSessionHeader` (watchers, change game). */
  header?: JSX.Element | undefined;
  /** Active board composition: use available desktop space without fitting it to metadata. */
  boardFocus?: boolean | undefined;
  /** Completed game's headline and existing next actions, before the final board. */
  outcome?: JSX.Element | undefined;
  notices?: JSX.Element | undefined;
  /**
   * Held at the top of the body as it scrolls, right under the host's top
   * bar, before the board: a phone's one status strip (whose turn, the
   * last move), so the board sits near the top and the strip stays in view.
   */
  pinned?: JSX.Element | undefined;
  /** Setup, invitation, waiting, or rematch controls, owned by the feature. */
  setup?: JSX.Element | undefined;
  children: JSX.Element;
  status?: JSX.Element | undefined;
  actions?: JSX.Element | undefined;
  /** Record, spectators, ratings, or other supporting information. */
  aside?: JSX.Element | undefined;
  /**
   * On wide screens, `status` and `actions` head the rail beside the board
   * (above `aside`) instead of following the board, so a game's commands
   * stay in view beside a board that fills the window's height. Phones
   * keep them right under the board either way.
   */
  actionsBeside?: boolean | undefined;
  /**
   * The board is only a preview while the game is set up: on wide screens
   * `setup` takes the main column and the board sits beside it, small.
   */
  boardPreview?: boolean | undefined;
  /**
   * A game played in real time: on wide screens its arena (wider than a
   * square board) takes the room and the rail beside it is narrow, holding
   * the players. Phones are unchanged. See `GameLayout`'s `arena`.
   */
  arena?: boolean | undefined;
  /**
   * An editor's workspace: the stage takes the whole game column (as wide
   * as a board and its rail) with nothing beside it, so an editor can set
   * its tools beside its canvas (`EditorWorkbench`). See `GameLayout`.
   */
  workspace?: boolean | undefined;
  /** Where a narrower stage sits in a one-column layout. See `GameLayout`. */
  stageAlign?: 'start' | 'center' | undefined;
  /** After everything: a `GameWatchingFooter` for someone watching. */
  footer?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/** What is said about the game in play, then its commands. */
function SessionControls(props: GameSessionLayoutProps): JSX.Element {
  return (
    <>
      {props.status}
      <GameActions>{props.actions}</GameActions>
    </>
  );
}

function SessionStage(props: GameSessionLayoutProps): JSX.Element {
  return (
    <>
      {props.children}
      <Show when={props.actionsBeside !== true}>
        <SessionControls {...props} />
      </Show>
    </>
  );
}

/**
 * Shared custom / matched game composition, including setup and results:
 * the board column holds the play surface with its status and actions
 * directly under it; setup and the aside share the rail beside it on wide
 * screens (`GameLayout`). With `actionsBeside` the status and actions head
 * that rail instead, while phones keep them under the board.
 * `pinned` stays at the top of the body as it scrolls (sticky).
 * `header`, `pinned` and `footer` resolve their content first: an empty slot (a false
 * `<Show>`, `null`, an empty fragment) draws nothing and takes no room. The
 * last row keeps a deliberate gap under it, so the play actions never end
 * flush against the screen's bottom edge.
 */
export function GameSessionLayout(props: GameSessionLayoutProps): JSX.Element {
  const header = createScreenSlot(() => props.header);
  const footer = createScreenSlot(() => props.footer);
  const pinned = createScreenSlot(() => props.pinned);
  const outcome = createScreenSlot(() => props.outcome);
  return (
    <div
      class={`box gap-4 min-w-0 pb-6 ${styles['session']}`}
      data-board-focus={props.boardFocus === true}
      {...dataAttrs({ component: 'GameSessionLayout', ...props.dataSet })}
    >
      <Show when={header.present()}>{header.content()}</Show>
      <Show when={outcome.present()}>
        <div
          class={styles['outcome']}
          {...dataAttrs({ component: 'GameSessionOutcome' })}
        >
          {outcome.content()}
        </div>
      </Show>
      <Show when={pinned.present()}>
        <div
          class={styles['pinned']}
          {...dataAttrs({ component: 'GameSessionPinned' })}
        >
          {pinned.content()}
        </div>
      </Show>
      {props.notices}
      <GameLayout
        setup={props.setup}
        controls={
          <Show when={props.actionsBeside === true}>
            <SessionControls {...props} />
          </Show>
        }
        aside={props.aside}
        stagePreview={props.boardPreview}
        arena={props.arena}
        workspace={props.workspace}
        stageAlign={props.stageAlign}
      >
        <SessionStage {...props} />
      </GameLayout>
      <Show when={footer.present()}>{footer.content()}</Show>
    </div>
  );
}

/**
 * The title row of a game: its name at the start, then what sits at the far
 * edge (a `GameWatcherCount`, a "Change game" button). Either may be absent;
 * with no name the rest reads from the start, as a strip of the game's facts.
 */
export function GameSessionHeader(props: {
  title?: JSX.Element | undefined;
  trailing?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
}): JSX.Element {
  const title = createScreenSlot(() => props.title);
  const trailing = createScreenSlot(() => props.trailing);
  return (
    <Show when={title.present() || trailing.present()}>
      <div
        class="box flex-row flex-wrap items-center gap-2 min-w-0"
        classList={{
          'justify-between': title.present(),
          'justify-start': !title.present(),
        }}
        {...dataAttrs({ component: 'GameSessionHeader', ...props.dataSet })}
      >
        <Show when={title.present()}>
          <div class="text textTitle min-w-0 truncate">{title.content()}</div>
        </Show>
        <Show when={trailing.present()}>
          <div class="box flex-row items-center gap-2 shrink-0">
            {trailing.content()}
          </div>
        </Show>
      </div>
    </Show>
  );
}

/** A full accessible identity with a single visual line in a constrained seat. */
export function GameSessionIdentity(props: {
  name: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <span
      class={styles['identity']}
      title={props.name}
      {...dataAttrs({ component: 'GameSessionIdentity' })}
    >
      {props.children}
    </span>
  );
}

/** A compact band of participant chips; seat details remain in their own chips. */
export function GameSessionParticipants(props: {
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class={styles['participants']}
      {...dataAttrs({ component: 'GameSessionParticipants' })}
    >
      {props.children}
    </div>
  );
}

/** Keeps the complete name available on a condensed participant chip. */
export function GameSessionParticipant(props: {
  name: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class="box min-w-0"
      title={props.name}
      {...dataAttrs({ component: 'GameSessionParticipant' })}
    >
      {props.children}
    </div>
  );
}
