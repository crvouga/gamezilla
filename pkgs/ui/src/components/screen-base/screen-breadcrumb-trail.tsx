/**
 * Visible breadcrumb trail for wide ScreenBase page headers.
 *
 * Ancestors render as a quiet secondary row above the page title so the
 * hierarchy reads top-down (`Settings › Sound` over a large `Sound`) instead
 * of mixing 16px crumbs and a 36px title on one baseline. Ancestors with
 * `onPress` are pressable; the current crumb is the title.
 */

import type { ReactNode } from 'react';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { ChevronRightIcon } from '../icons';
import { Pressable } from '../pressable';
import { Text } from '../text';
import type { ScreenBaseBreadcrumb } from './screen-base-types';

export type ScreenBreadcrumbTrailProps = {
  breadcrumbs: readonly ScreenBaseBreadcrumb[];
};

const SEPARATOR_SIZE = 14;

function CrumbSeparator(): ReactNode {
  const theme = useTheme();
  return (
    <ChevronRightIcon
      size={SEPARATOR_SIZE}
      color={theme.colors.textSecondary}
    />
  );
}

function AncestorCrumb({ crumb }: { crumb: ScreenBaseBreadcrumb }): ReactNode {
  const text = (
    <Text
      variant="label"
      numberOfLines={1}
      sx={{ color: 'textSecondary' }}
      label={crumb.name}
    />
  );
  if (crumb.onPress === undefined) {
    return text;
  }
  return (
    <Pressable
      onPress={crumb.onPress}
      accessibilityRole="link"
      sx={{ borderRadius: 'sm', px: 1, mx: -1 }}
    >
      {text}
    </Pressable>
  );
}

export function ScreenBreadcrumbTrail({
  breadcrumbs,
}: ScreenBreadcrumbTrailProps): ReactNode {
  if (breadcrumbs.length === 0) {
    return null;
  }
  const current = breadcrumbs[breadcrumbs.length - 1];
  const ancestors = breadcrumbs.slice(0, -1);
  return (
    <Box sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
      {ancestors.length > 0 ? (
        <Box
          sx={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          {ancestors.map((crumb, index) => (
            <Box
              key={`crumb-${index}`}
              sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}
            >
              <AncestorCrumb crumb={crumb} />
              {index < ancestors.length - 1 ? <CrumbSeparator /> : null}
            </Box>
          ))}
        </Box>
      ) : null}
      {current !== undefined ? (
        <Text variant="title" numberOfLines={1} label={current.name} />
      ) : null}
    </Box>
  );
}
