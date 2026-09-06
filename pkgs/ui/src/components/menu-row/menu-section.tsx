/**
 * `MenuSection` -- titled group of {@link MenuRow}s.
 *
 * The settings idiom: a quiet section label, a full-bleed {@link MenuList},
 * and an optional footer note. Stack several inside one ScreenBase body with
 * `gap: 5` so every settings / detail screen reads the same way.
 *
 * @example
 * ```tsx
 * <MenuSection title="Preferences" footer="Sound never changes device volume.">
 *   <MenuRow title="Appearance" value="Dark" onPress={goTheme} />
 *   <MenuRow title="Sound" trailing={<Switch … />} />
 * </MenuSection>
 * ```
 */

import type { ReactNode } from 'react';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Text } from '../text';
import { MenuList } from './menu-list';

export type MenuSectionProps = {
  /** Section label above the rows. */
  title?: ReactNode;
  /** Explanatory note under the rows. */
  footer?: ReactNode;
  children: ReactNode;
  /** Hairline separators between rows. Defaults to `true`. */
  separator?: boolean;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function MenuSection({
  title,
  footer,
  children,
  separator = true,
  dataSet,
}: MenuSectionProps) {
  return (
    <Box sx={{ gap: 1 }} dataSet={{ component: 'MenuSection', ...dataSet }}>
      {title !== undefined && title !== null ? (
        <Text
          variant="label"
          numberOfLines={1}
          sx={{ color: 'textSecondary' }}
          label={title}
        />
      ) : null}
      <MenuList separator={separator}>{children}</MenuList>
      {footer !== undefined && footer !== null ? (
        <Text variant="caption" label={footer} />
      ) : null}
    </Box>
  );
}
