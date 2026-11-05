import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, type JSX, Show } from 'solid-js';
import { useScreenFocus } from '../screen-focus/index';
import { ScreenIntro } from '../screen-intro/index';
import styles from '../screen-layouts.module.css';
import { createScreenSlot } from '../screen-slot';

export type PuzzleScreenProps = {
  screenId: string;
  /**
   * The screen's title, as every game screen opens (`ScreenIntro`): above
   * the board and its panel when wide, at the top of a phone's column, so
   * the mode is named on every size.
   */
  title?: JSX.Element | undefined;
  /**
   * Short facts on the title's own line, after it (the run so far, as
   * `StatPill`s), as a game screen's title carries its facts; they wrap
   * under the title only when the line is too short.
   */
  facts?: JSX.Element | undefined;
  /** Feed choices and coaching stay above the play surface. */
  header?: JSX.Element | undefined;
  children: JSX.Element;
  /** Width / height; rectangular boards fit the same well. Defaults to 1. */
  boardAspectRatio?: number | undefined;
  legend?: JSX.Element | undefined;
  timeline?: JSX.Element | undefined;
  actions?: JSX.Element | undefined;
  /** Announcements, completion feedback, and optional dialogs. */
  overlay?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

function requireBoardAspectRatio(value: number | undefined): number {
  const ratio = value ?? 1;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new RangeError('Board aspect ratio must be finite and positive');
  }
  return ratio;
}

type PuzzleArea = 'title' | 'header' | 'legend' | 'timeline' | 'actions';

function PuzzleFixedRegion(props: {
  children: JSX.Element;
  name: string;
  area: PuzzleArea;
}): JSX.Element {
  const slot = createScreenSlot(() => props.children);
  return (
    <Show when={slot.present()}>
      <div
        class={`${styles['fixed']} ${styles[props.area]}`}
        {...dataAttrs({ component: props.name })}
      >
        {slot.content()}
      </div>
    </Show>
  );
}

/**
 * Host-chrome puzzle play: largest fitting square, fixed controls, no second
 * bar. On a phone one column: the title and its facts, the header (feed,
 * coaching), the board, the legend, the move list, the actions; every
 * region's content keeps the page's one inset. Wide, the game screens' template:
 * the title over everything, the board on the left, and beside it one
 * panel card, as a game's record is, top to bottom: the header (feed, the
 * prompt), the actions right under the prompt, the move list, the legend.
 */
export function PuzzleScreen(props: PuzzleScreenProps): JSX.Element {
  const ratio = createMemo(() =>
    requireBoardAspectRatio(props.boardAspectRatio)
  );
  const facts = createScreenSlot(() => props.facts);
  let root: HTMLDivElement | undefined;
  useScreenFocus(
    () => root,
    () => props.screenId
  );
  return (
    <div class={styles['puzzleFrame']}>
      <div
        ref={root}
        class={styles['puzzle']}
        style={{ '--ui-puzzle-column-ratio': ratio() }}
        data-square={ratio() === 1}
        {...dataAttrs({
          component: 'PuzzleScreen',
          ...props.dataSet,
          screen: props.screenId,
        })}
      >
        <PuzzleFixedRegion name="PuzzleTitle" area="title">
          <Show when={props.title}>
            <div class={styles['puzzleHeading']}>
              <ScreenIntro title={props.title} />
              <Show when={facts.present()}>
                <div class={styles['puzzleFacts']}>{facts.content()}</div>
              </Show>
            </div>
          </Show>
        </PuzzleFixedRegion>
        {/* Wide: the card the panel column sits on, the game record's
            look; drawn under the panel's regions, never in a phone's flow. */}
        <div class={styles['panelCard']} aria-hidden="true" />
        <PuzzleFixedRegion name="PuzzleHeader" area="header">
          {props.header}
        </PuzzleFixedRegion>
        <div class={styles['well']}>
          <div
            class={styles['board']}
            style={{ '--ui-play-aspect-ratio': ratio() }}
            {...dataAttrs({ component: 'PuzzleBoard' })}
          >
            {props.children}
          </div>
        </div>
        <PuzzleFixedRegion name="PuzzleLegend" area="legend">
          {props.legend}
        </PuzzleFixedRegion>
        <PuzzleFixedRegion name="PuzzleTimeline" area="timeline">
          {props.timeline}
        </PuzzleFixedRegion>
        <PuzzleFixedRegion name="PuzzleActions" area="actions">
          {props.actions}
        </PuzzleFixedRegion>
        <div class={styles['overlay']}>{props.overlay}</div>
      </div>
    </div>
  );
}
