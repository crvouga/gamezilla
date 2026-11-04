/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { CompassIcon, InfoIcon } from '@pkgs/ui-root-client-ts/icons';
import type { Href } from '@pkgs/ui-root-shared-ts/href';
import type { JSX } from 'solid-js';

export type RouteStubScreenViewProps = {
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
  /** Leave for Spaces, the app's home. */
  readonly onGoToSpaces: () => void;
  /**
   * Return to the screen the person came from; set only when the app has
   * one to return to. Offered beside Go to Spaces.
   */
  readonly onGoBack?: (() => void) | undefined;
};

/**
 * Placeholder screen for routes whose Solid port has not landed yet, and the
 * `*` not-found screen, presentational. A real `ScreenBase` so header chrome,
 * breadcrumbs and the tab bar behave exactly as they will for the ported
 * screen. `RouteStub` wires the way back to Spaces, and Go back when the
 * app has a screen to return to.
 */
export function RouteStubScreenView(
  props: RouteStubScreenViewProps
): JSX.Element {
  const breadcrumbs = () => [
    ...(props.parent === undefined
      ? []
      : [{ name: props.parent.name, href: props.parent.href }]),
    { name: props.title },
  ];
  const goBack = () => {
    const back = props.onGoBack;
    return back === undefined
      ? undefined
      : { label: <Trans>Go back</Trans>, onClick: () => back() };
  };
  return (
    <ContentScreen screenId={props.screenId} breadcrumbs={breadcrumbs()}>
      <EmptyState
        icon={props.notFound === true ? CompassIcon : InfoIcon}
        title={
          props.notFound === true ? (
            <Trans>There's nothing at this address</Trans>
          ) : (
            props.title
          )
        }
        body={
          props.notFound === true ? (
            <Trans>
              The link may be old or mistyped. Your spaces are one tap away.
            </Trans>
          ) : (
            <Trans>This screen has not been ported to the web app yet.</Trans>
          )
        }
        action={{
          label: <Trans>Go to Spaces</Trans>,
          onClick: () => props.onGoToSpaces(),
        }}
        secondaryAction={goBack()}
        dataSet={{
          testid:
            props.notFound === true ? Handles.routeNotFound : 'route-stub',
        }}
      />
    </ContentScreen>
  );
}
