import type { DevIdpUser } from './users-api';

export type FormPayload = {
  readonly name: string;
  readonly email: string;
  readonly picture: string | null;
};

export type AccountPanelMode =
  | { readonly kind: 'closed' }
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly user: DevIdpUser };
