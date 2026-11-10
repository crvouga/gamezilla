import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { BotIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { type JSX, Show } from 'solid-js';
import { ObservatoryDenial } from './observatory-denial';

export type UserObservatoryScreenViewProps = {
  /** Set when the person may not open the User Observatory; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** Offers the Synthetic Population panel, the Synthetic Users' own part. */
  readonly canOpenSyntheticUsers: boolean;
  readonly onOpenSyntheticUsers: () => void;
  /** Whoever is online now; it reads its own list. */
  readonly onlineNow?: (() => JSX.Element) | undefined;
};

function UserObservatoryBody(
  props: UserObservatoryScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <ContentScreen
      screenId="user-observatory"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>User Observatory</Trans> },
      ]}
    >
      <Show when={props.canOpenSyntheticUsers}>
        <MenuSection title={<Trans>Synthetic Population</Trans>}>
          <MenuRow
            leading={<BotIcon size={20} color="icon" />}
            title={t`Synthetic Users`}
            caption={t`Their personas, the desired synthetic population and their control panels`}
            onClick={() => props.onOpenSyntheticUsers()}
            dataSet={{ testid: 'observatory-synthetic-users' }}
          />
        </MenuSection>
      </Show>
      {props.onlineNow?.()}
    </ContentScreen>
  );
}

/**
 * `/admin/observatory`, presentational: the User Observatory. Whoever is
 * online now, people and Synthetic Users, each opening a live view, and the
 * way into the Synthetic Population panel; its denied state replaces it.
 * `UserObservatoryScreen` wires it.
 */
export function UserObservatoryScreenView(
  props: UserObservatoryScreenViewProps
): JSX.Element {
  return (
    <Show when={props.denial} fallback={<UserObservatoryBody {...props} />}>
      {(denial) => <ObservatoryDenial denial={denial()} />}
    </Show>
  );
}
