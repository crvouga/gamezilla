import type { TextVariant } from '@pkgs/ui-root-client/text';
import type { JSX } from 'solid-js';

import { useSpaceDisplayTitle } from './use-space-display-title';

export type SpaceHostFallbackTitleProps = {
  spaceId: string;
  variant?: TextVariant;
  class?: string;
  numberOfLines?: number;
};

/**
 * Localized fallback title for a space that hasn't been explicitly named:
 * `${hostName}'s space`, or `Space` when the host username is still loading.
 */
export function SpaceHostFallbackTitle(
  props: SpaceHostFallbackTitleProps
): JSX.Element {
  const label = useSpaceDisplayTitle(props.spaceId);
  return (
    <p
      class="text textBody"
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
        // One line clamps by class, like the custom title in `SpaceTitleText`.
        'line-clamp-1 min-w-0': props.numberOfLines === 1,
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
      {label()}
    </p>
  );
}
