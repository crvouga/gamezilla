/** @jsxImportSource solid-js */
import { Box } from '@pkgs/ui';
import type { JSX } from 'solid-js';

/**
 * Full-bleed themed canvas — no spinner. Shown while the local database
 * boots for a new identity (the boot gate already covers first paint).
 */
export function BlankShell(): JSX.Element {
  return (
    <Box
      sx={{ flex: 1, background: 'background' }}
      dataSet={{ component: 'BlankShell' }}
    />
  );
}
