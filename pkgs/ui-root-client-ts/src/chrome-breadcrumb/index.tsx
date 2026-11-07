/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import { ChevronRightIcon } from '../icons';

/** One place in a chrome bar's trail. */
export type ChromeCrumb = {
  /** The place's name, as written in the bar. */
  name: JSX.Element;
  /** Present on a place the person can go to from here: a link. */
  onClick?: (() => void) | undefined;
  /** A mark before the name (the place's tile). */
  leading?: JSX.Element | undefined;
  /** `data-testid` on the name's text alone (never the mark). */
  nameTestId?: string | undefined;
  /** `data-testid` on the link, when the crumb is one. */
  linkTestId?: string | undefined;
};

/** `navigationTitle` (17) in a compact bar, `subtitle` (21) in a wide one. */
export type ChromeBreadcrumbSize = 'navigationTitle' | 'subtitle';

export type ChromeBreadcrumbProps = {
  crumbs: readonly ChromeCrumb[];
  /** Default `navigationTitle`. */
  size?: ChromeBreadcrumbSize | undefined;
  dataSet?: ComponentDataSet | undefined;
};

const SIZE: Readonly<Record<ChromeBreadcrumbSize, string>> = {
  navigationTitle: 'textNavigationTitle',
  subtitle: 'textSubtitle',
};

const SEPARATOR_SIZE = 18;

function CrumbBody(props: {
  crumb: ChromeCrumb;
  size: ChromeBreadcrumbSize;
  /** The current place in the full ink; every other in the quiet one. */
  current: boolean;
}): JSX.Element {
  return (
    <>
      {props.crumb.leading}
      <span
        class={`text ${SIZE[props.size]} line-clamp-1 min-w-0`}
        classList={{
          'text-text': props.current,
          'text-text-secondary': !props.current,
        }}
        data-testid={props.crumb.nameTestId}
      >
        {props.crumb.name}
      </span>
    </>
  );
}

/**
 * `ChromeBreadcrumb` -- where a host's chrome bar is, as one line of places
 * (`Friday game night › Chess`): the bar's one navigation control. A place
 * with `onClick` is a link (the way back is the parent's name, never a
 * second "Back" beside it); the last place without one is the current one,
 * in the full ink; the rest are quiet. Every name truncates on its own, so
 * a long room name never pushes the current place out of view.
 *
 * @example
 * ```tsx
 * <ChromeBreadcrumb
 *   size="subtitle"
 *   crumbs={[{ name: room(), onClick: back }, { name: game() }]}
 * />
 * ```
 */
export function ChromeBreadcrumb(props: ChromeBreadcrumbProps): JSX.Element {
  const { t } = useLingui();
  const size = (): ChromeBreadcrumbSize => props.size ?? 'navigationTitle';
  const last = (): number => props.crumbs.length - 1;
  return (
    <nav
      class="box min-w-0 max-w-full shrink"
      aria-label={t`Breadcrumb`}
      {...dataAttrs({ component: 'ChromeBreadcrumb', ...props.dataSet })}
    >
      <ol class="box flex-row items-center gap-1 min-w-0">
        <For each={props.crumbs}>
          {(crumb, index) => (
            <li
              class="box flex-row items-center gap-1 min-w-0"
              classList={{
                'shrink-0': index() === last(),
                shrink: index() !== last(),
              }}
            >
              <Show when={index() > 0}>
                <span class="box shrink-0" aria-hidden="true">
                  <ChevronRightIcon
                    size={SEPARATOR_SIZE}
                    color="textSecondary"
                  />
                </span>
              </Show>
              <Show
                when={crumb.onClick}
                fallback={
                  <span
                    class="box flex-row items-center gap-2 min-w-0 shrink"
                    aria-current={index() === last() ? 'page' : undefined}
                  >
                    <CrumbBody
                      crumb={crumb}
                      size={size()}
                      current={index() === last()}
                    />
                  </span>
                }
              >
                {(onClick) => (
                  <button
                    type="button"
                    role="link"
                    class="clickable clickableTint box flex-row items-center gap-2 min-w-0 shrink h-10 px-2 -mx-2 rounded-control"
                    data-component="ChromeBreadcrumbLink"
                    data-testid={crumb.linkTestId}
                    onClick={() => onClick()()}
                  >
                    <CrumbBody crumb={crumb} size={size()} current={false} />
                  </button>
                )}
              </Show>
            </li>
          )}
        </For>
      </ol>
    </nav>
  );
}
