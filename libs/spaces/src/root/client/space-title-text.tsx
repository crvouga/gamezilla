import { type SxProps, Text, type TextVariant } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { SpaceField, useSpaceColumn } from '../../public/use-space-column';
import { SpaceHostFallbackTitle } from './members/space-host-fallback-title';

export type SpaceTitleTextProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/**
 * Renders the user-set title for a space, falling back to the localized
 * `${hostName}'s space` template when no custom title is set.
 */
export function SpaceTitleText(props: SpaceTitleTextProps): JSX.Element {
  const customTitle = useSpaceColumn(props.spaceId, SpaceField.title);
  return (
    <Show
      when={customTitle()}
      fallback={
        <SpaceHostFallbackTitle
          spaceId={props.spaceId}
          {...(props.variant !== undefined ? { variant: props.variant } : {})}
          {...(props.sx !== undefined ? { sx: props.sx } : {})}
          {...(props.numberOfLines !== undefined
            ? { numberOfLines: props.numberOfLines }
            : {})}
        />
      }
    >
      <Text
        {...(props.variant !== undefined ? { variant: props.variant } : {})}
        {...(props.sx !== undefined ? { sx: props.sx } : {})}
        {...(props.numberOfLines !== undefined
          ? { numberOfLines: props.numberOfLines }
          : {})}
        label={customTitle() ?? ''}
      />
    </Show>
  );
}
