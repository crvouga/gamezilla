import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { GameLayout } from '../game-screen/index';
import { GameActions } from '../game-section/index';
import { createScreenSlot } from '../screen-slot';

export type GameSessionLayoutProps = {
  /** The title row: a `GameSessionHeader` (watchers, change game). */
  header?: JSX.Element | undefined;
  notices?: JSX.Element | undefined;
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
 * `header` and `footer` resolve their content first: an empty slot (a false
 * `<Show>`, `null`, an empty fragment) draws nothing and takes no room. The
 * last row keeps a deliberate gap under it, so the play actions never end
 * flush against the screen's bottom edge.
 */
export function GameSessionLayout(props: GameSessionLayoutProps): JSX.Element {
  const header = createScreenSlot(() => props.header);
  const footer = createScreenSlot(() => props.footer);
  return (
    <div
      class="box gap-4 min-w-0 pb-6"
      {...dataAttrs({ component: 'GameSessionLayout', ...props.dataSet })}
    >
      <Show when={header.present()}>{header.content()}</Show>
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
