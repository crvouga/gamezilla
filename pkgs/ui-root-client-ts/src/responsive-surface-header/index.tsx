/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { CloseIconButton } from '../close-icon-button/index';
import { useModalTitleId } from '../modal-title-id/index';

export type ResponsiveSurfaceHeaderProps = {
  /** When omitted, the row is close-only (X top-right) when closable. */
  title?: JSX.Element | undefined;
  onClose: () => void;
  /** When `false`, omit the close control. Default `true`. */
  closable?: boolean | undefined;
  /** `data-*` identifiers for the close control. */
  closeDataSet?: ComponentDataSet | undefined;
};

export function hasSurfaceTitle(title: JSX.Element | undefined): boolean {
  return title !== undefined && title !== null && title !== '';
}

/**
 * Shared header row for {@link ResponsiveSurface}: an optional `textSubtitle`
 * title, left-aligned, and the close control on the right, in a row at least
 * 44px tall. The title carries the surface title id so the dialog is named
 * by it.
 */
export function ResponsiveSurfaceHeader(
  props: ResponsiveSurfaceHeaderProps
): JSX.Element {
  const titleId = useModalTitleId();
  const hasTitle = (): boolean => hasSurfaceTitle(props.title);
  const closable = (): boolean => props.closable ?? true;
  const showHeader = (): boolean => hasTitle() || closable();
  return (
    <Show when={showHeader()}>
      <div
        class="box flex-row items-center mb-3 gap-2 min-h-11"
        classList={{
          'justify-between': hasTitle(),
          'justify-end': !hasTitle(),
        }}
        data-component="ResponsiveSurfaceHeader"
      >
        <Show when={hasTitle()}>
          <h2
            class="text textSubtitle line-clamp-1 flex-1 min-w-0 text-text"
            id={titleId}
          >
            {props.title}
          </h2>
        </Show>
        <Show when={closable()}>
          <CloseIconButton
            onClick={() => props.onClose()}
            dataSet={props.closeDataSet}
          />
        </Show>
      </div>
    </Show>
  );
}
