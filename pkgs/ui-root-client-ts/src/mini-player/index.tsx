/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { useLayoutMode } from '../use-layout-mode';

export type MiniPlayerDockProps = {
  children?: JSX.Element | undefined;
};

export type MiniPlayerBarProps = {
  children?: JSX.Element | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

/**
 * `MiniPlayerDock` / `MiniPlayerBar` -- the bottom-pinned dock that brings
 * a person back to what they left running (a live space), above the tab bar.
 *
 * The geometry follows the layout mode, so a feature never picks it:
 * - compact: the bar runs edge to edge, square, flush on the tab bar;
 * - wide: the bar spans the app column with a small gap above it and the
 *   card radius (still a dock, not a floating pill).
 *
 * `MiniPlayerDock` is the frame (it may also hold the dock's sheets);
 * `MiniPlayerBar` is the painted bar, a row of its children, at least as
 * tall as a two-line row with an avatar.
 *
 * @example
 * ```tsx
 * <MiniPlayerDock>
 *   <MiniPlayerBar testId="miniplayer">
 *     <Pressable grow onPress={open} direction="horizontal" align="center">…</Pressable>
 *     <Button title={t`End`} size="sm" intent="neutral" />
 *   </MiniPlayerBar>
 * </MiniPlayerDock>
 * ```
 */
export function MiniPlayerDock(props: MiniPlayerDockProps): JSX.Element {
  const mode = useLayoutMode();
  return (
    <div
      class="box w-full self-stretch"
      classList={{ 'pt-ui-sm': mode() === 'wide' }}
      data-component={componentId('MiniPlayerDock')}
      data-layout={mode()}
    >
      {props.children}
    </div>
  );
}

export function MiniPlayerBar(props: MiniPlayerBarProps): JSX.Element {
  const mode = useLayoutMode();
  return (
    <div
      class="box w-full self-stretch flex-row items-center gap-ui-sm overflow-hidden min-h-18 bg-surface border border-border"
      classList={{
        'rounded-card': mode() === 'wide',
        'rounded-none': mode() !== 'wide',
      }}
      data-testid={props.testId}
      data-component={componentId('MiniPlayerBar')}
    >
      {props.children}
    </div>
  );
}
