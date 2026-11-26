import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createSignal, type JSX, Show } from 'solid-js';
import { EmbeddedScreen } from '../embedded-screen/index';
import { GameBoardLeadContext } from '../game-board-stage/board-lead';
import styles from '../game-ui.module.css';
import { ScreenIntro } from '../screen-intro/index';
import { createScreenSlot } from '../screen-slot';
import heading from './game-heading.module.css';

/**
 * A game inside its host's chrome. The host's one top bar carries the back
 * control and the space; the game names itself once in the body and then
 * gets out of the way of the board. Never a second bar. With `facts` (a
 * game in play) a phone shows only the facts: its top bar already names
 * the game, and the title stays for a listener.
 *
 * Every game screen is one column centered in the frame, its title block
 * at the column's start edge: as wide as the board and its rail together
 * when there is a rail (`GameLayout`), as wide as a game menu when there is
 * no board beside a rail (a search, a choice), and the whole frame for
 * anything else. The title therefore lines up with what is under it.
 */
export function GameScreen(props: {
  screenId: string;
  title: JSX.Element;
  subtitle?: JSX.Element | undefined;
  /**
   * The game's facts on the title's own line, after it (`Unrated`, the
   * clock, how many watch), so they cost the board no row of their own;
   * they wrap under the title only when the line is too short.
   */
  facts?: JSX.Element | undefined;
  /**
   * The title names what the host's bar does not (a puzzle by its own
   * name, under a bar that names its game): a phone keeps it beside the
   * facts instead of leaving it for a listener only.
   */
  keepTitle?: boolean | undefined;
  /**
   * The screen's own next command (a builder's next step), at the title's
   * end where it fits and under it where it does not: in the flow, so it
   * never covers the stage, and in the first screen without a card of its
   * own over the board.
   */
  actions?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
  children: JSX.Element;
}): JSX.Element {
  const facts = createScreenSlot(() => props.facts);
  return (
    <EmbeddedScreen
      screenId={props.screenId}
      width="full"
      dataSet={{ ...props.dataSet, component: 'GameScreen' }}
    >
      <div class={styles['column']} {...dataAttrs({ component: 'GameColumn' })}>
        <Show
          when={facts.present()}
          fallback={
            <ScreenIntro
              title={props.title}
              subtitle={props.subtitle}
              actions={props.actions}
            />
          }
        >
          <div
            class={heading['heading']}
            data-keep-title={props.keepTitle === true}
            {...dataAttrs({ component: 'GameHeading' })}
          >
            <div
              class={heading['headingTitle']}
              {...dataAttrs({ component: 'GameHeadingTitle' })}
            >
              <ScreenIntro
                title={props.title}
                subtitle={props.subtitle}
                actions={props.actions}
              />
            </div>
            <div class={heading['facts']}>{facts.content()}</div>
          </div>
        </Show>
        {props.children}
      </div>
    </EmbeddedScreen>
  );
}

export type GameLayoutProps = {
  children: JSX.Element;
  /** Setup, invitation or waiting controls; beside the stage when wide. */
  setup?: JSX.Element | undefined;
  /**
   * What is said and done about the game in play (its status, its
   * commands): right under the stage on phones; under setup, heading the
   * rail, when wide.
   */
  controls?: JSX.Element | undefined;
  aside?: JSX.Element | undefined;
  /**
   * The stage is only a preview (a game still being set up): on wide
   * screens setup takes the main column and the stage sits beside it, at
   * its top, at a preview's size.
   */
  stagePreview?: boolean | undefined;
  /**
   * The stage is a real-time game's arena, wider than it is tall: on wide
   * screens it takes its column's room beside the same rail as every game
   * (the players), instead of a square board's measure.
   */
  arena?: boolean | undefined;
  /**
   * The stage is an editor's workspace: the stage takes the column's whole
   * width, as wide as a board and its rail, with nothing beside it.
   */
  workspace?: boolean | undefined;
};

/** `GameLayout`'s grid, given how far its board sits below the stage's top. */
function GameLayoutGrid(
  props: GameLayoutProps & { boardLead: number }
): JSX.Element {
  const stage = createScreenSlot(() => props.children);
  const setup = createScreenSlot(() => props.setup);
  const controls = createScreenSlot(() => props.controls);
  const aside = createScreenSlot(() => props.aside);
  // The rail's rows, one per slot beside the stage, so the stage spans them.
  const railRows = (): number =>
    [setup.present(), controls.present(), aside.present()].filter(Boolean)
      .length;
  return (
    <Show
      when={
        stage.present() ||
        setup.present() ||
        controls.present() ||
        aside.present()
      }
    >
      <div
        class={styles['layout']}
        style={{
          '--game-rail-rows': String(Math.max(1, railRows())),
          '--game-board-lead': `${props.boardLead}px`,
        }}
        data-has-stage={stage.present()}
        data-has-setup={setup.present()}
        data-has-aside={aside.present()}
        data-stage-preview={props.stagePreview === true}
        data-arena={props.arena === true}
        data-workspace={props.workspace === true}
        {...dataAttrs({ component: 'GameLayout' })}
      >
        <Show when={setup.present()}>
          <div class={styles['setup']}>{setup.content()}</div>
        </Show>
        <div class={styles['stage']}>{stage.content()}</div>
        <Show when={controls.present()}>
          <div
            class={styles['controls']}
            {...dataAttrs({ component: 'GameControls' })}
          >
            {controls.content()}
          </div>
        </Show>
        <Show when={aside.present()}>
          <div class={styles['rail']}>{aside.content()}</div>
        </Show>
      </div>
    </Show>
  );
}

/**
 * The board column and its supporting rail. On phones everything stacks in
 * reading order: setup, the stage, the controls, then the rail. On wide
 * screens the stage is one board-wide column with setup, the controls and
 * the rail beside it, top to bottom, in one narrow column, so none of them
 * pushes the board down and the play commands stay in view beside it. The
 * rail starts level with the board's top edge (the seat above the board
 * sits beside nothing). An empty slot takes no room, and toggling the rail,
 * setup or controls never remounts the play surface.
 */
export function GameLayout(props: GameLayoutProps): JSX.Element {
  // How far the board sits below the stage's top (the seat above it).
  const [boardLead, setBoardLead] = createSignal(0);
  return (
    <GameBoardLeadContext.Provider value={setBoardLead}>
      <GameLayoutGrid {...props} boardLead={boardLead()} />
    </GameBoardLeadContext.Provider>
  );
}
