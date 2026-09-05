/**
 * Visible breadcrumb trail for wide ScreenBase page headers.
 * Ancestors with `onPress` are pressable; the current crumb is the title.
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

function CrumbSeparator(): ReactNode {
  const theme = useTheme();
  return <ChevronRightIcon size={16} color={theme.colors.textSecondary} />;
}

function AncestorCrumb({ crumb }: { crumb: ScreenBaseBreadcrumb }): ReactNode {
  if (crumb.onPress === undefined) {
    return (
      <Text variant="body" sx={{ color: 'textSecondary' }} label={crumb.name} />
    );
  }
  return (
    <Pressable onPress={crumb.onPress} accessibilityRole="link">
      <Text variant="body" sx={{ color: 'textSecondary' }} label={crumb.name} />
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
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1.5,
        flex: 1,
        minWidth: 0,
      }}
    >
      {ancestors.map((crumb, index) => (
        <Box
          key={`crumb-${index}`}
          sx={{ flexDirection: 'row', alignItems: 'center', gap: 1.5 }}
        >
          <AncestorCrumb crumb={crumb} />
          <CrumbSeparator />
        </Box>
      ))}
      {current !== undefined ? (
        <Text variant="title" label={current.name} />
      ) : null}
    </Box>
  );
}
