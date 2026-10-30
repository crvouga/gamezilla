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

function PuzzleFixedRegion(props: {
  children: JSX.Element;
  name: string;
}): JSX.Element {
  const slot = createScreenSlot(() => props.children);
  return (
    <Show when={slot.present()}>
      <div class={styles['fixed']} {...dataAttrs({ component: props.name })}>
        {slot.content()}
      </div>
    </Show>
  );
}

/** Host-chrome puzzle play: largest fitting square, fixed controls, no second bar. */
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
    <div
      ref={root}
      class={styles['puzzle']}
      {...dataAttrs({
        component: 'PuzzleScreen',
        ...props.dataSet,
        screen: props.screenId,
      })}
    >
      <PuzzleFixedRegion name="PuzzleHeader">{props.header}</PuzzleFixedRegion>
      <div class={styles['well']}>
        <div
          class={styles['board']}
          style={{ '--ui-play-aspect-ratio': ratio() }}
          {...dataAttrs({ component: 'PuzzleBoard' })}
        >
          {props.children}
        </div>
      </div>
      {props.legend}
      <PuzzleFixedRegion name="PuzzleTimeline">
        {props.timeline}
      </PuzzleFixedRegion>
      <PuzzleFixedRegion name="PuzzleActions">
        {props.actions}
      </PuzzleFixedRegion>
      {props.overlay}
    </div>
  );
}
