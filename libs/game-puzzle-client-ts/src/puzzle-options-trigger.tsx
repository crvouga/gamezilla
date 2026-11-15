import { Trans } from '@lingui/solid/macro';
import { EllipsisIcon } from '@pkgs/ui-root-client-ts/icons';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';

/**
 * A puzzle menu's face in the dock: a 44px outlined pill that says its
 * name ("Options"; the host bar has its own More), the same on the play
 * and the result.
 */
export function PuzzleOptionsTrigger(): JSX.Element {
  return (
    <Surface
      tone="background"
      radius="full"
      border
      paddingX="md"
      paddingY="md"
      direction="horizontal"
      align="center"
      gap="xs"
    >
      <EllipsisIcon size={20} color="icon" />
      <Text variant="label">
        <Trans>Options</Trans>
      </Text>
    </Surface>
  );
}
