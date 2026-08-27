import { Box } from '@pkgs/ui';
import type { ReactNode } from 'react';

/** Full-bleed themed canvas — no spinner. Used while splash still covers native. */
export function ThemedBlankShell(): ReactNode {
  return <Box sx={{ flex: 1, background: 'background' }} />;
}
