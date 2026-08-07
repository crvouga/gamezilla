/**
 * `CatalogDetailNav` -- slim prev / next controls for a catalog detail screen.
 *
 * Use inside {@link ScreenBase}'s `footer` slot (app screens) or as the inner
 * row of {@link CatalogDetail}'s bottom chrome bar (embeds). Clamped at the
 * ends (buttons disabled); no wrap-around.
 */

import type { ReactNode } from 'react';

import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { releaseWebFocus } from '../../web/release-web-focus';
import { Box } from '../box';
import { IconButton } from '../icon-button';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';
import { Text } from '../text';
import { type CatalogItem, resolveCatalogNeighbor } from './catalog-item';

export type CatalogDetailNavProps = {
  items: readonly CatalogItem[];
  currentId: string;
  onNavigate: (id: string) => void;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function CatalogDetailNav({
  items,
  currentId,
  onNavigate,
  dataSet,
}: CatalogDetailNavProps): ReactNode {
  const neighbor = resolveCatalogNeighbor(items, currentId);
  const label = neighbor.current?.label ?? currentId;
  const position =
    neighbor.index >= 0
      ? `${neighbor.index + 1} of ${neighbor.total}`
      : `— of ${neighbor.total}`;

  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        py: 1,
      }}
      {...componentDataSet('CatalogDetailNav', dataSet)}
    >
      <IconButton
        label="Previous"
        size={36}
        disabled={neighbor.prev === null}
        onPress={() => {
          if (neighbor.prev === null) return;
          releaseWebFocus();
          onNavigate(neighbor.prev.id);
        }}
      >
        <ChevronLeftIcon size={18} />
      </IconButton>

      <Box sx={{ flex: 1, alignItems: 'center', gap: 0.5 }}>
        <Text variant="label" label={label} />
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={position}
        />
      </Box>

      <IconButton
        label="Next"
        size={36}
        disabled={neighbor.next === null}
        onPress={() => {
          if (neighbor.next === null) return;
          releaseWebFocus();
          onNavigate(neighbor.next.id);
        }}
      >
        <ChevronRightIcon size={18} />
      </IconButton>
    </Box>
  );
}
