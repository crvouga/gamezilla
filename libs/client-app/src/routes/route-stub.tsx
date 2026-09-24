/** @jsxImportSource solid-js */
/**
 * Placeholder screen for routes whose Solid port has not landed yet, and the
 * `*` not-found screen. A real `ScreenBase` so header chrome, breadcrumbs and
 * the tab bar behave exactly as they will for the ported screen.
 */

import { Trans } from '@lingui/solid/macro';
import {
  EmptyState,
  type Href,
  InfoIcon,
  ScreenBase,
  useRouter,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';

export type RouteStubProps = {
  /** Stable DOM `data-screen` id, e.g. `more-theme`. */
  readonly screenId: string;
  /** Screen title (also the last breadcrumb). */
  readonly title: JSX.Element;
  /** Parent crumb for nested screens; omitted on tab roots. */
  readonly parent?:
    | { readonly name: JSX.Element; readonly href: Href }
    | undefined;
  /** Not-found variant (catch-all route). */
  readonly notFound?: boolean | undefined;
};

export function RouteStub(props: RouteStubProps): JSX.Element {
  const router = useRouter();
  const breadcrumbs = () => [
    ...(props.parent === undefined
      ? []
      : [{ name: props.parent.name, href: props.parent.href }]),
    { name: props.title },
  ];
  return (
    <ScreenBase
      screenId={props.screenId}
      breadcrumbs={breadcrumbs()}
      content={() => (
        <EmptyState
          icon={InfoIcon}
          title={
            props.notFound === true ? (
              <Trans>Page not found</Trans>
            ) : (
              props.title
            )
          }
          body={
            props.notFound === true ? (
              <Trans>There is nothing at this address.</Trans>
            ) : (
              <Trans>This screen has not been ported to the web app yet.</Trans>
            )
          }
          action={{
            label: <Trans>Go to Spaces</Trans>,
            onClick: () => router.replace('/'),
          }}
          dataSet={{
            testid: props.notFound === true ? 'route-not-found' : 'route-stub',
          }}
        />
      )}
    />
  );
}
