/** @jsxImportSource solid-js */
/**
 * `CatalogDetailNav` -- slim prev / next controls for a catalog detail screen.
 *
 * Use inside a screen `footer` slot (app screens) or as the inner row of
 * {@link CatalogDetail}'s bottom chrome bar (embeds). Clamped at the ends
 * (buttons disabled); no wrap-around.
 */

import { useLingui } from '@lingui/solid/macro';
import { createMemo, type JSX } from 'solid-js';

import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Clickable } from '../clickable';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  type IconComponent,
} from '../icons';
import { Text } from '../text';
import { type CatalogItem, resolveCatalogNeighbor } from './catalog-item';

const NAV_VISUAL_SIZE = 36;
const NAV_HIT_SIZE = 44;

export type CatalogDetailNavProps = {
  items: readonly CatalogItem[];
  currentId: string;
  onNavigate: (id: string) => void;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function NavButton(props: {
  label: string;
  icon: IconComponent;
  target: CatalogItem | null;
  onNavigate: (id: string) => void;
}): JSX.Element {
  return (
    <Clickable
      aria-label={props.label}
      disabled={props.target === null}
      onClick={() => {
        if (props.target !== null) props.onNavigate(props.target.id);
      }}
      feedback="opacity"
      sx={{
        width: NAV_HIT_SIZE,
        height: NAV_HIT_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: props.target === null ? 0.4 : 1,
      }}
    >
      <Box
        sx={{
          width: NAV_VISUAL_SIZE,
          height: NAV_VISUAL_SIZE,
          borderRadius: 'full',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <props.icon size={18} />
      </Box>
    </Clickable>
  );
}

export function CatalogDetailNav(props: CatalogDetailNavProps): JSX.Element {
  const { t } = useLingui();
  const neighbor = createMemo(() =>
    resolveCatalogNeighbor(props.items, props.currentId)
  );
  const label = () => neighbor().current?.label ?? props.currentId;
  const position = () => {
    const n = neighbor();
    const total = n.total;
    if (n.index < 0) return t`— of ${total}`;
    const current = n.index + 1;
    return t`${current} of ${total}`;
  };

  return (
    <Box
      as="nav"
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        py: 1,
      }}
      dataSet={{ component: 'CatalogDetailNav', ...props.dataSet }}
    >
      <NavButton
        label={t`Previous`}
        icon={ChevronLeftIcon}
        target={neighbor().prev}
        onNavigate={props.onNavigate}
      />
      <Box sx={{ flex: 1, alignItems: 'center', gap: 0.5 }}>
        <Text variant="label" label={label()} />
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={position()}
        />
      </Box>
      <NavButton
        label={t`Next`}
        icon={ChevronRightIcon}
        target={neighbor().next}
        onNavigate={props.onNavigate}
      />
    </Box>
  );
}
