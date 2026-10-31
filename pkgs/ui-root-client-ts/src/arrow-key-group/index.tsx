/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { SpaceToken } from '@pkgs/ui-root-shared-ts/token-names';
import type { JSX } from 'solid-js';
import { spacingClass } from '../space-classes';

export type ArrowKeyGroupProps = {
  /** Names the group, and should say which keys step through it. */
  'aria-label': string;
  /** `ArrowLeft` while the group has focus. */
  onPrevious: () => void;
  /** `ArrowRight` while the group has focus. */
  onNext: () => void;
  /** Space between children. Default `lg`. */
  gap?: SpaceToken | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
  children?: JSX.Element | undefined;
};

/**
 * `ArrowKeyGroup` -- a focusable group the left and right arrow keys step
 * through: the moves of a game, the pages of a carousel. The group takes
 * focus in the tab order, and while it has focus `ArrowLeft` calls
 * `onPrevious` and `ArrowRight` calls `onNext`; every other key passes
 * through to its children. Its children stack top to bottom.
 *
 * @example
 * ```tsx
 * <ArrowKeyGroup
 *   aria-label={t`Moves. The left and right arrow keys step through them.`}
 *   onPrevious={view.stepBack}
 *   onNext={view.stepForward}
 * >
 *   <MoveList />
 *   <ReviewButtons />
 * </ArrowKeyGroup>
 * ```
 */
export function ArrowKeyGroup(props: ArrowKeyGroupProps): JSX.Element {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') props.onPrevious();
    else props.onNext();
  };
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a focused group owns the arrow keys that step through its items
    <div
      class={`box min-w-0 rounded-control ${spacingClass({ gap: props.gap ?? 'lg' })}`}
      role="group"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the group itself takes focus so the arrow keys reach it
      tabIndex={0}
      aria-label={props['aria-label']}
      onKeyDown={onKeyDown}
      data-testid={props.testId}
      data-component={componentId('ArrowKeyGroup')}
    >
      {props.children}
    </div>
  );
}
