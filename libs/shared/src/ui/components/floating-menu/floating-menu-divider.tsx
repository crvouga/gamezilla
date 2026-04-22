/**
 * Horizontal rule between groups inside {@link FloatingMenu}.
 * @internal Used only by {@link FloatingMenu}; not exported from `@gamezilla/shared/ui`.
 */

import { Box } from '../box';

export function FloatingMenuDivider() {
  return <Box sx={{ height: 1, background: 'border', my: 1 }} />;
}
