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
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { ChevronRightIcon } from '../icons';
import { Text } from '../text';
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
    <Text
      variant="label"
      numberOfLines={1}
      sx={{ color: 'textSecondary' }}
      label={props.crumb.name}
    />
  );
  return (
    <Show when={props.onClick} fallback={text()}>
      {(onClick) => (
        <Clickable
          role="link"
          onClick={() => onClick()()}
          sx={{ borderRadius: 'sm', px: 1, mx: -1, minHeight: 32 }}
          dataSet={{ component: 'ScreenBreadcrumbLink' }}
        >
          {text()}
        </Clickable>
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
      <Box
        as="nav"
        aria-label={t`Breadcrumb`}
        sx={{ flex: 1, minWidth: 0, gap: 0.5 }}
        dataSet={{ component: 'ScreenBreadcrumbTrail', ...props.dataSet }}
      >
        <Show when={trail().ancestors.length > 0}>
          <Box
            sx={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <For each={trail().ancestors}>
              {(crumb, index) => (
                <Box
                  sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}
                >
                  <AncestorCrumb crumb={crumb} onClick={resolveClick(crumb)} />
                  <Show when={index() < trail().ancestors.length - 1}>
                    <ChevronRightIcon
                      size={SEPARATOR_SIZE}
                      color="textSecondary"
                    />
                  </Show>
                </Box>
              )}
            </For>
          </Box>
        </Show>
        <Show when={trail().current}>
          {(current) => (
            <Text
              as="h1"
              variant="title"
              numberOfLines={1}
              label={current().name}
            />
          )}
        </Show>
      </Box>
    </Show>
  );
}
