import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { BotIcon, RadioIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { type JSX, Show } from 'solid-js';
import { ObservatoryDenial } from './observatory-denial';

export type UserObservatoryScreenViewProps = {
  /** Set when the person may not open the User Observatory; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** Opens Online now: everyone using the app, as a table. */
  readonly onOpenOnlineNow: () => void;
  /** Offers the Synthetic Population panel, the Synthetic Users' own part. */
  readonly canOpenSyntheticUsers: boolean;
  readonly onOpenSyntheticUsers: () => void;
};

function UserObservatoryLinks(
  props: UserObservatoryScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuScreen
      screenId="user-observatory"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>User Observatory</Trans> },
      ]}
    >
      <MenuSection title={<Trans>Using the app</Trans>}>
        <MenuRow
          leading={<RadioIcon size={20} color="icon" />}
          title={t`Online now`}
          caption={t`Everyone using the app now, people and Synthetic Users, and watching them live`}
          onClick={() => props.onOpenOnlineNow()}
          dataSet={{ testid: 'observatory-online-now' }}
        />
      </MenuSection>
      <Show when={props.canOpenSyntheticUsers}>
        <MenuSection title={<Trans>Synthetic Population</Trans>}>
          <MenuRow
            leading={<BotIcon size={20} color="icon" />}
            title={t`Synthetic Population`}
            caption={t`The Synthetic Users, their workers, events and the desired synthetic population`}
            onClick={() => props.onOpenSyntheticUsers()}
            dataSet={{ testid: 'observatory-synthetic-users' }}
          />
        </MenuSection>
      </Show>
    </MenuScreen>
  );
}

/**
 * `/admin/observatory`, presentational: the User Observatory's hub. It
 * only links onward: to Online now (whoever is using the app, as a table,
 * each opening a live view) and, for those who may, to the Synthetic
 * Population panel. Its denied state replaces it.
 * `UserObservatoryScreen` wires it.
 */
export function UserObservatoryScreenView(
  props: UserObservatoryScreenViewProps
): JSX.Element {
  return (
    <Show when={props.denial} fallback={<UserObservatoryLinks {...props} />}>
      {(denial) => <ObservatoryDenial denial={denial()} />}
    </Show>
  );
}
