import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { dynamic, type JSX } from '@solidjs/web';
import { Button as SdkButton } from '@ui-sdk/solid/button';
import { For, Show } from 'solid-js';
import { ChevronRightIcon } from '../icons';
import type { ScreenBaseBreadcrumb } from '../screen-base-types';
import { useBreadcrumbClick } from '../use-breadcrumb-click';

function StaticCrumb(props: {
  name: JSX.Element;
  current: boolean;
  titleId: string | undefined;
}): JSX.Element {
  const Tag = dynamic(() =>
    props.current && props.titleId !== undefined ? 'h1' : 'span'
  );
  return (
    <Tag
      id={props.current ? props.titleId : undefined}
      class={[
        'text px-4 h-11 inline-flex items-center rounded-full border',
        {
          'textBodyBold bg-tint-subtle border-outline': props.current,
          'textBody text-text-secondary border-transparent': !props.current,
        },
      ]}
      aria-current={props.current ? 'page' : undefined}
    >
      {props.name}
    </Tag>
  );
}

/** Compact, scrollable ancestor pills for the app's wide navigation island. */
export function BreadcrumbPills(props: {
  breadcrumbs: readonly ScreenBaseBreadcrumb[];
  titleId?: string | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const resolveClick = useBreadcrumbClick('ancestor');
  return (
    <nav
      aria-label={t`Breadcrumb`}
      class="box min-w-0 overflow-x-auto scrollHideBar"
      data-component="ScreenBreadcrumbPills"
    >
      <ol class="box flex-row items-center gap-1">
        <For each={props.breadcrumbs}>
          {(crumb, index) => (
            <li class="box flex-row items-center gap-1 shrink-0">
              <Show when={index() > 0}>
                <ChevronRightIcon size={16} color="textSecondary" />
              </Show>
              <Show
                when={
                  index() < props.breadcrumbs.length - 1 && resolveClick(crumb)
                }
                fallback={
                  <StaticCrumb
                    name={crumb.name}
                    current={index() === props.breadcrumbs.length - 1}
                    titleId={props.titleId}
                  />
                }
              >
                {(click) => (
                  <SdkButton
                    type="button"
                    role="link"
                    data-testid={
                      index() === props.breadcrumbs.length - 2
                        ? 'nav-back'
                        : undefined
                    }
                    class="clickable clickableTint text textBody px-4 h-11 rounded-full border border-transparent"
                    onClick={() => click()()}
                  >
                    {crumb.name}
                  </SdkButton>
                )}
              </Show>
            </li>
          )}
        </For>
      </ol>
    </nav>
  );
}
