import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, type JSX, Show } from 'solid-js';
import { useScreenFocus } from '../screen-focus/index';
import styles from '../screen-layouts.module.css';
import { createScreenSlot } from '../screen-slot';

export type PuzzleScreenProps = {
  screenId: string;
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

type PuzzleArea = 'header' | 'legend' | 'timeline' | 'actions';

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
 * bar. On a phone one column: the header (feed, coaching), the board, the
 * legend, the move list, the actions. Wide, the game screens' template:
 * the board on the left at the window's height, and beside it one panel
 * column holding the header, the legend and the move list from its top and
 * the actions at its foot, level with the board's bottom edge.
 */
export function PuzzleScreen(props: PuzzleScreenProps): JSX.Element {
  const ratio = createMemo(() =>
    requireBoardAspectRatio(props.boardAspectRatio)
  );
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
        {...dataAttrs({
          component: 'PuzzleScreen',
          ...props.dataSet,
          screen: props.screenId,
        })}
      >
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
