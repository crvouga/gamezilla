/** @jsxImportSource solid-js */
/**
 * `CommandPaletteHint` -- footer legend under the palette list
 * (`↑ ↓ navigate · ↵ run · Esc close`). Pass `legend` to override.
 */

import { useLingui } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import { Box } from '../box';
import { Text } from '../text';

export type CommandPaletteHintProps = {
  legend?: JSX.Element | undefined;
};

export function CommandPaletteHint(
  props: CommandPaletteHintProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <Box
      sx={{ px: 3, pb: 2, pt: 1 }}
      dataSet={{ component: 'CommandPaletteHint' }}
    >
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={props.legend ?? t`↑ ↓ navigate · ↵ run · Esc close · Tab next`}
      />
    </Box>
  );
}
