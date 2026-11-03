import type {
  TextAlign,
  TextLines,
} from '@pkgs/ui-root-client-ts/text-classes';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { useProfileColumn } from './use-profile-column';
import { type UsernameRole, UserUsernameView } from './user-username-view';

export type UserUsernameProps = {
  /** Profile entity id (account or install id). `null` renders nothing. */
  profileId: string | null;
  /** Default `body`. A display size renders the name as the identity heading. */
  variant?: UsernameRole | undefined;
  /** Clamp to this many lines; a clamped name is a block, otherwise inline. */
  numberOfLines?: TextLines | undefined;
  align?: TextAlign | undefined;
  /** When true, prefix with `@` (never on a masked alias). Default true. */
  withAt?: boolean | undefined;
  /** Only `testid` is written (as `data-testid` on the name). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * Renders the persisted username for a profile id from SQLite, as the
 * moderation policy lets others see it (a masked name shows its alias).
 * Returns `null` when no profile id is supplied; renders an empty text when
 * the row hasn't synced (so layout positioning stays stable).
 */
export function UserUsername(props: UserUsernameProps): JSX.Element {
  const profileId = () => (props.profileId === null ? null : props.profileId);
  return (
    <Show when={profileId()} keyed>
      {(id) => (
        <UserUsernameInner
          profileId={id}
          withAt={props.withAt ?? true}
          variant={props.variant}
          numberOfLines={props.numberOfLines}
          align={props.align}
          dataSet={props.dataSet}
        />
      )}
    </Show>
  );
}

type InnerProps = Omit<UserUsernameProps, 'profileId' | 'withAt'> & {
  profileId: string;
  withAt: boolean;
};

function UserUsernameInner(props: InnerProps): JSX.Element {
  const username = useProfileColumn(() => props.profileId, 'username');
  const kind = useProfileColumn(() => props.profileId, 'accountKind');
  return (
    <UserUsernameView
      profileId={props.profileId}
      username={username()}
      isBot={kind() === 'synthetic'}
      withAt={props.withAt}
      variant={props.variant}
      numberOfLines={props.numberOfLines}
      align={props.align}
      dataSet={props.dataSet}
    />
  );
}
