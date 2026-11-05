/** @jsxImportSource solid-js */
/**
 * Placeholder screen for routes whose Solid port has not landed yet, and the
 * `*` not-found screen. A real `ScreenBase` so header chrome, breadcrumbs and
 * the tab bar behave exactly as they will for the ported screen.
 */

import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from 'solid-js';
import {
  RouteStubScreenView,
  type RouteStubScreenViewProps,
} from './route-stub-screen-view';

export type RouteStubProps = Omit<
  RouteStubScreenViewProps,
  'onGoToSpaces' | 'onGoToSearch' | 'onGoToProfile' | 'onGoBack'
>;

/**
 * Wires `RouteStubScreenView`'s ways out to the router: replace with Spaces,
 * or back, when this app pushed the screen before it.
 */
export function RouteStub(props: RouteStubProps): JSX.Element {
  const router = useRouter();
  return (
    <RouteStubScreenView
      screenId={props.screenId}
      title={props.title}
      parent={props.parent}
      notFound={props.notFound}
      onGoToSpaces={() => router.replace('/')}
      onGoToSearch={() => router.replace('/search')}
      onGoToProfile={() => router.replace('/profile')}
      onGoBack={router.canGoBack() ? () => router.back() : undefined}
    />
  );
}
