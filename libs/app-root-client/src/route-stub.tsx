/** @jsxImportSource solid-js */
/**
 * Placeholder screen for routes whose Solid port has not landed yet, and the
 * `*` not-found screen. A real `ScreenBase` so header chrome, breadcrumbs and
 * the tab bar behave exactly as they will for the ported screen.
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { ContentScreen } from '@pkgs/ui-root-client/content-screen';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { InfoIcon } from '@pkgs/ui-root-client/icons';
import type { Href } from '@pkgs/ui-root-shared/href';
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
    <ContentScreen screenId={props.screenId} breadcrumbs={breadcrumbs()}>
      <EmptyState
        icon={InfoIcon}
        title={
          props.notFound === true ? <Trans>Page not found</Trans> : props.title
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
          testid:
            props.notFound === true ? Handles.routeNotFound : 'route-stub',
        }}
      />
    </ContentScreen>
  );
}
