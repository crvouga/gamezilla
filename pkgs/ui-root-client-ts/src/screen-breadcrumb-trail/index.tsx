/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { ChevronRightIcon } from '../icons';
import { splitBreadcrumbTrail } from '../screen-base-logic';
import type { ScreenBaseBreadcrumb } from '../screen-base-types';
import { useBreadcrumbClick } from '../use-breadcrumb-click';

export type ScreenBreadcrumbTrailProps = {
  breadcrumbs: readonly ScreenBaseBreadcrumb[];
  dataSet?: ComponentDataSet | undefined;
};

const SEPARATOR_SIZE = 16;

function AncestorCrumb(props: {
  crumb: ScreenBaseBreadcrumb;
  onClick: (() => void) | undefined;
}): JSX.Element {
  const text = (): JSX.Element => (
    <span class="text textCaption line-clamp-1">{props.crumb.name}</span>
  );
  return (
    <Show when={props.onClick} fallback={text()}>
      {(onClick) => (
        <button
          class="clickable clickableTint rounded-sm px-1 -mx-1 min-h-6 justify-center"
          data-component="ScreenBreadcrumbLink"
          type="button"
          role="link"
          onClick={() => onClick()()}
        >
          {text()}
        </button>
      )}
    </Show>
  );
}

/**
 * Visible breadcrumb trail for wide `ScreenBase` page headers.
 *
 * Ancestors render as a quiet caption row (14px, secondary) above the page
 * title so the hierarchy reads top-down (`Settings › Sound` over a 24px
 * `Sound`).
 * Ancestors with `onClick` / `href` are links; the current crumb is the
 * `h1` title.
 */
export function ScreenBreadcrumbTrail(
  props: ScreenBreadcrumbTrailProps
): JSX.Element {
  const { t } = useLingui();
  const resolveClick = useBreadcrumbClick(() => props.breadcrumbs);
  const trail = createMemo(() => splitBreadcrumbTrail(props.breadcrumbs));
  return (
    <Show when={props.breadcrumbs.length > 0}>
      <nav
        class="box flex-1 min-w-0 gap-1"
        {...dataAttrs({ component: 'ScreenBreadcrumbTrail', ...props.dataSet })}
        aria-label={t`Breadcrumb`}
      >
        <Show when={trail().ancestors.length > 0}>
          <div class="box flex-row items-center flex-wrap gap-1">
            <For each={trail().ancestors}>
              {(crumb, index) => (
                <div class="box flex-row items-center gap-1">
                  <AncestorCrumb crumb={crumb} onClick={resolveClick(crumb)} />
                  <Show when={index() < trail().ancestors.length - 1}>
                    <ChevronRightIcon
                      size={SEPARATOR_SIZE}
                      color="textSecondary"
                    />
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={trail().current}>
          {(current) => (
            <h1 class="text textHeading line-clamp-1">{current().name}</h1>
          )}
        </Show>
      </nav>
    </Show>
  );
}
