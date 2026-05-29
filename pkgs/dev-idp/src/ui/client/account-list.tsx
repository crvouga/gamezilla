/** @jsxImportSource hono/jsx/dom */
import { c } from '../styles';
import { AccountRow } from './account-row';
import type { DevIdpUser } from './users-api';

export type AccountListState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly users: readonly DevIdpUser[] }
  | { readonly kind: 'error'; readonly message: string };

export const AccountList = (props: {
  list: AccountListState;
  pendingDeleteSub: string | null;
  onSignIn: (sub: string) => void;
  onEdit: (sub: string) => void;
  onRequestDelete: (sub: string) => void;
  onConfirmDelete: (sub: string) => void;
  onCancelDelete: (sub: string) => void;
}) => (
  <div
    class={c.users}
    role="list"
    aria-labelledby="dev-idp-accounts-label"
    data-testid="dev-idp-account-list"
    data-state={props.list.kind}
    aria-live="polite"
    aria-busy={props.list.kind === 'loading' ? 'true' : 'false'}
  >
    {props.list.kind === 'loading' && (
      <div class={c.empty} data-testid="dev-idp-account-list-loading">
        Loading accounts…
      </div>
    )}
    {props.list.kind === 'error' && (
      <div
        class={c.empty}
        data-testid="dev-idp-account-list-error"
        role="alert"
      >
        Could not load accounts: {props.list.message}
      </div>
    )}
    {props.list.kind === 'loaded' && props.list.users.length === 0 && (
      <div class={c.empty} data-testid="dev-idp-account-list-empty">
        No accounts yet. Add one below.
      </div>
    )}
    {props.list.kind === 'loaded' &&
      props.list.users.map((u) => (
        <AccountRow
          key={u.sub}
          user={u}
          pendingDelete={props.pendingDeleteSub === u.sub}
          onSignIn={props.onSignIn}
          onEdit={props.onEdit}
          onRequestDelete={props.onRequestDelete}
          onConfirmDelete={props.onConfirmDelete}
          onCancelDelete={props.onCancelDelete}
        />
      ))}
  </div>
);
