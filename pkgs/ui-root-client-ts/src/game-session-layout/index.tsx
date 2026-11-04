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
  /** After everything: a `GameWatchingFooter` for someone watching. */
  footer?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

function SessionStage(props: GameSessionLayoutProps): JSX.Element {
  return (
    <>
      {props.children}
      {props.status}
      <GameActions>{props.actions}</GameActions>
    </>
  );
}

/**
 * Shared custom / matched game composition, including setup and results:
 * the board column holds the play surface with its status and actions
 * directly under it; setup and the aside share the rail beside it on wide
 * screens (`GameLayout`).
 * `header` and `footer` resolve their content first: an empty slot (a false
 * `<Show>`, `null`, an empty fragment) draws nothing and takes no room.
 */
export function GameSessionLayout(props: GameSessionLayoutProps): JSX.Element {
  const header = createScreenSlot(() => props.header);
  const footer = createScreenSlot(() => props.footer);
  return (
    <div
      class="box gap-4 min-w-0"
      {...dataAttrs({ component: 'GameSessionLayout', ...props.dataSet })}
    >
      <Show when={header.present()}>{header.content()}</Show>
      {props.notices}
      <GameLayout setup={props.setup} aside={props.aside}>
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
