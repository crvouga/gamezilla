import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import {
  type Accessor,
  children,
  createSignal,
  onSettled,
  Show,
} from 'solid-js';
import { observeElementResize } from '../observe-element-resize';
import styles from './word-tile-workspace.module.css';

/** Wide enough for a 27rem board beside a tools column. */
const WIDE_REM = 38;

/**
 * The height of the board's box (`data-game-board`) the workspace sits in,
 * when its host holds that box still and scrolls what it holds
 * (`overflow-y: auto`: a fixed stage on a phone, the window's height left
 * beside a wide game's rail); `undefined` anywhere else, where the box is
 * as tall as the workspace.
 */
function heldRoom(element: HTMLElement): number | undefined {
  const region = element.closest<HTMLElement>('[data-game-board]');
  const view = element.ownerDocument.defaultView;
  if (!region || !view) return undefined;
  const scrolls = view.getComputedStyle(region).overflowY;
  return scrolls === 'auto' || scrolls === 'scroll'
    ? region.clientHeight
    : undefined;
}

/**
 * Whether the workspace is wide enough to set its board beside its tools,
 * and the held room it fills (`heldRoom`). Read before the first paint,
 * then whenever the workspace or its box changes size.
 */
function createWorkspaceMeasure(root: () => HTMLElement | undefined): {
  wide: Accessor<boolean>;
  room: Accessor<number | undefined>;
} {
  const [wide, setWide] = createSignal(false);
  const [room, setRoom] = createSignal<number>();
  onSettled(() => {
    const element = root();
    if (!element) return undefined;
    const rem =
      Number.parseFloat(
        getComputedStyle(element.ownerDocument.documentElement).fontSize
      ) || 16;
    const read = (): void => {
      setWide(element.getBoundingClientRect().width >= WIDE_REM * rem);
      setRoom(heldRoom(element));
    };
    read();
    const region = element.closest('[data-game-board]');
    const stops = [element, ...(region ? [region] : [])].map((target) =>
      observeElementResize(target, read)
    );
    return () => {
      for (const stop of stops) stop();
    };
  });
  return { wide, room };
}

/**
 * One seat's word workspace, in reading order for its layout. On phones:
 * notice, rack, actions, feedback, then the board. When wide: notice, the
 * board with its feedback beside it, then the rack beside the actions, right
 * above the player's own seat. Source order always follows what is on screen,
 * so Tab and screen readers move the way the eye does. In a board box its
 * host holds still, the workspace fills the box and sizes its board to the
 * room the rack, actions and feedback leave (`data-fill`), so all of them
 * show without scrolling.
 */
export function WordTileWorkspace(props: {
  notice?: JSX.Element;
  rack: JSX.Element;
  actions?: JSX.Element;
  feedback?: JSX.Element;
  board: JSX.Element;
  /** A finished game: the board is for review, so it takes less room. */
  finished?: boolean;
}): JSX.Element {
  let root: HTMLDivElement | undefined;
  const { wide, room } = createWorkspaceMeasure(() => root);
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
  return (
    <div
      ref={root}
      class={styles['layout']}
      data-layout={wide() ? 'wide' : 'stacked'}
      data-finished={String(props.finished === true)}
      data-fill={room() === undefined ? undefined : 'true'}
      style={{
        '--word-tile-room': room() === undefined ? undefined : `${room()}px`,
      }}
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
