/** @jsxImportSource hono/jsx/dom */
import { c } from '../styles';
import type { DevIdpUser } from './users-api';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export const AccountRowAvatar = (props: { user: DevIdpUser }) => (
  <div class={c.avatar} data-testid="dev-idp-account-avatar">
    {props.user.picture !== null && props.user.picture.length > 0 ? (
      <img
        src={props.user.picture}
        alt=""
        data-testid="dev-idp-account-avatar-image"
      />
    ) : (
      initials(props.user.name || '?')
    )}
  </div>
);
