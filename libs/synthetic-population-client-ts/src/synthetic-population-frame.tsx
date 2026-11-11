import {
  OBSERVATORY_PATH,
  SYNTHETIC_USERS_PATH,
  syntheticUserPath,
} from '@libs/observatory-shared-ts/observatory-routes';
import { Trans, useLingui } from '@lingui/solid/macro';
import { RefreshCwIcon } from '@pkgs/ui-root-client-ts/icons';
import type {
  ScreenBaseAction,
  ScreenBaseBreadcrumb,
} from '@pkgs/ui-root-client-ts/screen-base-types';

/**
 * The trail every Synthetic Population screen starts with, down to the
 * panel's hub, then `tail`: the screen's own place under it.
 */
export function panelCrumbs(
  tail: readonly ScreenBaseBreadcrumb[]
): ScreenBaseBreadcrumb[] {
  return [
    { name: <Trans>Profile</Trans>, href: '/profile' },
    { name: <Trans>Settings</Trans>, href: '/more' },
    { name: <Trans>User Observatory</Trans>, href: OBSERVATORY_PATH },
    ...(tail.length === 0
      ? [{ name: <Trans>Synthetic Population</Trans> }]
      : [
          {
            name: <Trans>Synthetic Population</Trans>,
            href: SYNTHETIC_USERS_PATH,
          },
          ...tail,
        ]),
  ];
}

/**
 * The trail of a screen under one Synthetic User's control panel: its
 * name links back to the panel, then the screen's own name.
 */
export function syntheticUserCrumbs(
  user: { readonly id: string; readonly username: string } | undefined,
  current: ScreenBaseBreadcrumb
): ScreenBaseBreadcrumb[] {
  return panelCrumbs([
    user === undefined
      ? { name: <Trans>Synthetic User</Trans>, href: SYNTHETIC_USERS_PATH }
      : { name: user.username, href: syntheticUserPath(user.id) },
    current,
  ]);
}

/**
 * The quiet header Refresh every reading screen offers: live updates reread
 * on their own, so it only shows progress while a read runs.
 */
export function useRefreshAction(props: {
  readonly loading: boolean;
  readonly onRefresh: () => void;
}): () => ScreenBaseAction[] {
  const { t } = useLingui();
  return () => [
    {
      type: 'secondary',
      label: t`Refresh`,
      icon: RefreshCwIcon,
      loading: props.loading,
      onClick: () => props.onRefresh(),
    },
  ];
}
