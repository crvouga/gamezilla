import type { TextVariant } from '@pkgs/ui-client/text';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { SpaceField, useSpaceColumn } from './use-space-column';
import { SpaceHostFallbackTitle } from './space-host-fallback-title';

export type SpaceTitleTextProps = {
  spaceId: string;
  variant?: TextVariant;
  class?: string;
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
          {...(props.class !== undefined ? { class: props.class } : {})}
          {...(props.numberOfLines !== undefined
            ? { numberOfLines: props.numberOfLines }
            : {})}
        />
      }
    >
      <p
        class="text min-w-0"
        classList={{
          textBodyBold: String(props.variant) === 'bodyBold',
          textCaption: String(props.variant) === 'caption',
          textLabel: String(props.variant) === 'label',
          textTitle: String(props.variant) === 'title',
          textSubtitle: String(props.variant) === 'subtitle',
          textHeading: String(props.variant) === 'heading',
          textNavigationTitle: String(props.variant) === 'navigationTitle',
          textLink: String(props.variant) === 'link',
          textMono: String(props.variant) === 'mono',
          'line-clamp-1': props.numberOfLines === 1,
          [String(props.class)]: true,
        }}
        style={
          props.numberOfLines !== undefined && props.numberOfLines > 1
            ? {
                display: '-webkit-box',
                '-webkit-box-orient': 'vertical',
                '-webkit-line-clamp': props.numberOfLines,
                overflow: 'hidden',
              }
            : undefined
        }
      >
        {customTitle() ?? ''}
      </p>
    </Show>
  );
}
