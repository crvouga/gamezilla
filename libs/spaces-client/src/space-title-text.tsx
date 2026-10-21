import type { TextRole } from '@pkgs/ui-root-client/text';
import { Text } from '@pkgs/ui-root-client/text';
import type { TextLines } from '@pkgs/ui-root-client/text-classes';
import type { JSX } from 'solid-js';
import { useSpaceDisplayTitle } from './use-space-display-title';

export type SpaceTitleTextProps = {
  spaceId: string;
  /** Type role; default `inherit` takes the surrounding title's type. */
  variant?: TextRole | 'inherit' | undefined;
  lines?: TextLines | undefined;
};

/**
 * Renders the user-set title for a space, falling back to the localized
 * `${hostName}'s space` template when no custom title is set or the
 * moderation policy masks it.
 */
export function SpaceTitleText(props: SpaceTitleTextProps): JSX.Element {
  const title = useSpaceDisplayTitle(() => props.spaceId);
  return (
    <Text variant={props.variant ?? 'inherit'} lines={props.lines}>
      {title()}
    </Text>
  );
}
