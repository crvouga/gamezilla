/**
 * `PageHeader` -- body-level title block (iOS large-title style).
 *
 * Lives inside the body of a screen, just below the {@link TopBar} /
 * {@link ScreenBaseHeader} chrome. Keeps the top bar at a fixed height
 * across every screen and gives page-specific context (title + subtitle)
 * its own breathing room in the content area.
 *
 * `ScreenBase` auto-renders this when the deepest breadcrumb has a
 * `subtitle`; you can also import it directly for screens that opt out of
 * `ScreenBase`.
 *
 * @example
 * ```tsx
 * <PageHeader title="Spaces" subtitle="Rooms to play with friends" />
 * ```
 */

import type { ReactNode } from 'react';

import { Box } from '../box';
import { Text } from '../text';

export type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Cross-axis alignment. Defaults to `'start'`. */
  align?: 'start' | 'center';
};

const ALIGN_TO_ITEMS = {
  start: 'flex-start',
  center: 'center',
} as const;

const ALIGN_TO_TEXT = {
  start: 'left',
  center: 'center',
} as const;

export function PageHeader({
  title,
  subtitle,
  align = 'start',
}: PageHeaderProps): ReactNode {
  return (
    <Box
      sx={{
        gap: 1,
        pb: 2,
        alignItems: ALIGN_TO_ITEMS[align],
      }}
    >
      <Text
        accessibilityRole="header"
        aria-level={1}
        variant="title"
        sx={{ color: 'text' }}
        style={{ textAlign: ALIGN_TO_TEXT[align] }}
        label={title}
      />
      {subtitle !== undefined && subtitle !== null ? (
        <Text
          variant="body"
          sx={{ color: 'textSecondary' }}
          style={{ textAlign: ALIGN_TO_TEXT[align] }}
          label={subtitle}
        />
      ) : null}
    </Box>
  );
}
