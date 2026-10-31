/** @jsxImportSource solid-js */
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';
/**
 * `CatalogDetailNav` -- slim prev / next controls for a catalog detail screen.
 *
 * Use inside a screen `footer` slot (app screens) or as the inner row of
 * {@link CatalogDetail}'s bottom chrome bar (embeds). Clamped at the ends
 * (buttons disabled); no wrap-around.
 */

import { useLingui } from '@lingui/solid/macro';
import type { CatalogItem } from '@pkgs/ui-root-shared-ts/catalog-item';
import { resolveCatalogNeighbor } from '@pkgs/ui-root-shared-ts/catalog-item';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, type JSX } from 'solid-js';
import type { IconComponent } from '../create-icon/index';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';

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
    <button
      class="clickable clickableOpacity items-center justify-center"
      type="button"
      style={{
        width: cssPx(NAV_HIT_SIZE),
        height: cssPx(NAV_HIT_SIZE),
        opacity: props.target === null ? 0.4 : 1,
      }}
      aria-label={props.label}
      disabled={props.target === null}
      onClick={() => {
        if (props.target !== null) props.onNavigate(props.target.id);
      }}
    >
      <div
        class="box rounded-full items-center justify-center"
        style={{
          width: cssPx(NAV_VISUAL_SIZE),
          height: cssPx(NAV_VISUAL_SIZE),
        }}
      >
        <props.icon size={18} />
      </div>
    </button>
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
    <nav
      class="box flex-row items-center justify-between gap-2 py-1"
      {...dataAttrs({ component: 'CatalogDetailNav', ...props.dataSet })}
    >
      <NavButton
        label={t`Previous`}
        icon={ChevronLeftIcon}
        target={neighbor().prev}
        onNavigate={props.onNavigate}
      />
      <div class="box flex-1 items-center gap-1">
        <label class="text textLabel">{label()}</label>
        <p class="text textCaption text-text-secondary">{position()}</p>
      </div>
      <NavButton
        label={t`Next`}
        icon={ChevronRightIcon}
        target={neighbor().next}
        onNavigate={props.onNavigate}
      />
    </nav>
  );
}
