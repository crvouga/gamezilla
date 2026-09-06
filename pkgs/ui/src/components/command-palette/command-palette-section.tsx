/** @jsxImportSource solid-js */
/**
 * `CommandPaletteSection` -- sticky-looking group header inside the palette
 * list (`Recent`, category names). Rendered as `role="presentation"` so the
 * listbox option count stays clean for assistive tech.
 */

import type { JSX } from 'solid-js';
import { Box } from '../box';
import { Text } from '../text';

export type CommandPaletteSectionProps = {
  title: string;
  id?: string | undefined;
};

export function CommandPaletteSection(
  props: CommandPaletteSectionProps
): JSX.Element {
  return (
    <Box
      id={props.id}
      role="presentation"
      sx={{ px: 3, pt: 2, pb: 1, backgroundColor: 'background' }}
      dataSet={{ component: 'CommandPaletteSection' }}
    >
      <Text
        variant="label"
        sx={{ color: 'textSecondary', letterSpacing: 0.5 }}
        label={props.title}
      />
    </Box>
  );
}
