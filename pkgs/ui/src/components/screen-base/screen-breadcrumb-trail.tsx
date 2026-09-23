/** @jsxImportSource solid-js */
/**
 * Visible breadcrumb trail for wide `ScreenBase` page headers.
 *
 * Ancestors render as a quiet secondary row above the page title so the
 * hierarchy reads top-down (`Settings › Sound` over a large `Sound`).
 * Ancestors with `onClick` / `href` are links; the current crumb is the
 * `h1` title.
 */

import { useLingui } from '@lingui/solid/macro';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import { ChevronRightIcon } from '../icons';
import { splitBreadcrumbTrail } from './screen-base-logic';
import type { ScreenBaseBreadcrumb } from './screen-base-types';
import { useBreadcrumbClick } from './use-breadcrumb-click';

export type ScreenBreadcrumbTrailProps = {
  breadcrumbs: readonly ScreenBaseBreadcrumb[];
  dataSet?: ComponentDataSet | undefined;
};

const SEPARATOR_SIZE = 14;

function AncestorCrumb(props: {
  crumb: ScreenBaseBreadcrumb;
  onClick: (() => void) | undefined;
}): JSX.Element {
  const text = (): JSX.Element => (
    <label class="text textLabel line-clamp-1 text-text-secondary">
      {props.crumb.name}
    </label>
  );
  return (
    <Show when={props.onClick} fallback={text()}>
      {(onClick) => (
        <button
          class="clickable clickableTint rounded-sm px-1 [margin-left:-4px;margin-right:-4px] min-h-[32px]"
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

export function ScreenBreadcrumbTrail(
  props: ScreenBreadcrumbTrailProps
): JSX.Element {
  const { t } = useLingui();
  const resolveClick = useBreadcrumbClick(() => props.breadcrumbs);
  const trail = createMemo(() => splitBreadcrumbTrail(props.breadcrumbs));
  return (
    <Show when={props.breadcrumbs.length > 0}>
      <nav
        class="box flex-1 min-w-[0] gap-0.5"
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
                    <div
                      class="box items-center justify-center"
                      style={{
                        width: `${SEPARATOR_SIZE}px`,
                        height: '22px',
                      }}
                      aria-hidden="true"
                    >
                      <ChevronRightIcon
                        size={SEPARATOR_SIZE}
                        color="textSecondary"
                      />
                    </div>
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
