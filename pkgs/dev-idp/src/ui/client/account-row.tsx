/** @jsxImportSource hono/jsx/dom */
/**
 * Single account row in the chooser. The whole row is the sign-in
 * trigger (mirrors Google's account chooser).
 */
import { c } from '../styles';
import { AccountRowActions } from './account-row-actions';
import { AccountRowAvatar } from './account-row-avatar';
import type { DevIdpUser } from './users-api';

export const AccountRow = (props: {
  user: DevIdpUser;
  pendingDelete: boolean;
  onSignIn: (sub: string) => void;
  onEdit: (sub: string) => void;
  onRequestDelete: (sub: string) => void;
  onConfirmDelete: (sub: string) => void;
  onCancelDelete: (sub: string) => void;
}) => {
  const { user, pendingDelete } = props;
  return (
    <div
      class={c.userRow}
      data-account-row
      data-testid="dev-idp-account-row"
      data-sub={user.sub}
      data-email={user.email}
      data-name={user.name}
      data-pending-delete={pendingDelete ? 'true' : 'false'}
      tabIndex={0}
      role="button"
      aria-label={`Sign in as ${user.name}`}
      onClick={() => props.onSignIn(user.sub)}
      onKeyDown={(ev: KeyboardEvent) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          props.onSignIn(user.sub);
        }
      }}
    >
      <AccountRowAvatar user={user} />
      <div class={c.ident}>
        <div class={c.identName} data-testid="dev-idp-account-name">
          {user.name}
        </div>
        <div class={c.identEmail} data-testid="dev-idp-account-email">
          {user.email}
        </div>
      </div>
      <AccountRowActions
        pendingDelete={pendingDelete}
        onConfirmDelete={() => props.onConfirmDelete(user.sub)}
        onCancelDelete={() => props.onCancelDelete(user.sub)}
        onEdit={() => props.onEdit(user.sub)}
        onRequestDelete={() => props.onRequestDelete(user.sub)}
      />
    </div>
  );
};
