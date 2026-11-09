import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  children,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { observeElementResize } from '../observe-element-resize';
import styles from './word-tile-workspace.module.css';

/** Wide enough for a 27rem board beside a tools column. */
const WIDE_REM = 38;

/**
 * One seat's word workspace, in reading order for its layout. On phones:
 * notice, rack, actions, feedback, then the board. When wide: notice, the
 * board with its feedback beside it, then the rack beside the actions, right
 * above the player's own seat. Source order always follows what is on screen,
 * so Tab and screen readers move the way the eye does.
 */
export function WordTileWorkspace(props: {
  notice?: JSX.Element;
  rack: JSX.Element;
  actions?: JSX.Element;
  feedback?: JSX.Element;
  board: JSX.Element;
}): JSX.Element {
  const [wide, setWide] = createSignal(false);
  let root: HTMLDivElement | undefined;
  // Resolved once, so switching layouts moves the same nodes and keeps state.
  const notice = children(() => (
    <div class={styles['notice']}>{props.notice}</div>
  ));
  const rack = children(() => <div class={styles['rack']}>{props.rack}</div>);
  const actions = children(() => (
    <div class={styles['actions']}>{props.actions}</div>
  ));
  const feedback = children(() => (
    <div class={styles['feedback']}>{props.feedback}</div>
  ));
  const board = children(() => (
    <div class={styles['board']}>{props.board}</div>
  ));
  onMount(() => {
    const element = root;
    if (!element) return;
    const rem =
      Number.parseFloat(
        getComputedStyle(element.ownerDocument.documentElement).fontSize
      ) || 16;
    const read = (): void => {
      setWide(element.getBoundingClientRect().width >= WIDE_REM * rem);
    };
    // Measured before the first paint, then on every resize.
    read();
    onCleanup(observeElementResize(element, read));
  });
  return (
    <div
      ref={root}
      class={styles['layout']}
      data-layout={wide() ? 'wide' : 'stacked'}
      {...dataAttrs({ component: 'WordTileWorkspace' })}
    >
      <Show
        when={wide()}
        fallback={
          <>
            {notice()}
            {rack()}
            {actions()}
            {feedback()}
            {board()}
          </>
        }
      >
        {notice()}
        {board()}
        {feedback()}
        {rack()}
        {actions()}
      </Show>
    </div>
  );
}
