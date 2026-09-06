/** @jsxImportSource solid-js */
/**
 * Shared header row for {@link ResponsiveSurface} (optional title + close).
 * The title carries the surface title id so the dialog is named by it.
 */

import { type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { CloseIconButton } from '../close-icon-button';
import { useModalTitleId } from '../modal/modal-title-id';
import { Text } from '../text';

export type ResponsiveSurfaceHeaderProps = {
  /** When omitted, the row is close-only (X top-right). */
  title?: JSX.Element | undefined;
  onClose: () => void;
  /** `data-*` identifiers for the close control. */
  closeDataSet?: ComponentDataSet | undefined;
};

export function hasSurfaceTitle(title: JSX.Element | undefined): boolean {
  return title !== undefined && title !== null && title !== '';
}

export function ResponsiveSurfaceHeader(
  props: ResponsiveSurfaceHeaderProps
): JSX.Element {
  const titleId = useModalTitleId();
  const hasTitle = (): boolean => hasSurfaceTitle(props.title);
  return (
    <Box
      dataSet={{ component: 'ResponsiveSurfaceHeader' }}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: hasTitle() ? 'space-between' : 'flex-end',
        mb: 3,
        gap: 2,
      }}
    >
      <Show when={hasTitle()}>
        <Text
          id={titleId}
          variant="subtitle"
          label={props.title}
          numberOfLines={1}
          sx={{ flex: 1, mr: 2 }}
        />
      </Show>
      <CloseIconButton
        onClick={() => props.onClose()}
        dataSet={props.closeDataSet}
      />
    </Box>
  );
}
