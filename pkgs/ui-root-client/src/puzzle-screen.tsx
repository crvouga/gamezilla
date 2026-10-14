import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import { useScreenFocus } from './screen-focus';
import styles from './screen-layouts.module.css';

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

/** Host-chrome puzzle play: largest fitting square, fixed controls, no second bar. */
export function PuzzleScreen(props: PuzzleScreenProps): JSX.Element {
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
      <div class={styles['fixed']}>{props.header}</div>
      <div class={styles['well']}>
        <div
          class={styles['board']}
          style={{ '--ui-play-aspect-ratio': props.boardAspectRatio ?? 1 }}
        >
          {props.children}
        </div>
      </div>
      {props.legend}
      <div class={styles['fixed']}>{props.timeline}</div>
      <div class={styles['fixed']}>{props.actions}</div>
      {props.overlay}
    </div>
  );
}
