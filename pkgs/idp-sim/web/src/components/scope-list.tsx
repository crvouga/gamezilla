/** What the app asked for: one icon plus plain-language copy per scope. */

import {
  type IconComponent,
  InfoIcon,
  MailIcon,
  UserIcon,
} from '@pkgs/ui/components/icons';
import { For } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import { IDP_BRAND } from '../../../src/shared/brand';
import type { IdpProviderKind } from '../../../src/shared/types';

const LABEL: Record<IdpProviderKind, Record<string, string>> = {
  google: {
    openid: `Associate you with your ${IDP_BRAND.name} account`,
    email: 'See your primary email address',
    profile:
      'See your personal info, including any that you have made publicly available',
  },
  apple: {
    name: 'Your name',
    email: 'Your email address, or a relay address that forwards to it',
  },
};

const ICON: Record<string, IconComponent> = {
  openid: UserIcon,
  email: MailIcon,
  profile: InfoIcon,
  name: UserIcon,
};

const SCOPE_ICON_SIZE = 20;

export function ScopeList(props: {
  readonly scopes: readonly string[];
  readonly provider: IdpProviderKind;
}) {
  return (
    <ul class="box gap-4">
      <For each={props.scopes}>
        {(scope) => (
          <li class="box flex-row items-center gap-4">
            <Dynamic
              component={ICON[scope] ?? InfoIcon}
              size={SCOPE_ICON_SIZE}
              color="textSecondary"
            />
            <span class="text textLabel text-text-secondary">
              {LABEL[props.provider][scope] ?? scope}
            </span>
          </li>
        )}
      </For>
    </ul>
  );
}
