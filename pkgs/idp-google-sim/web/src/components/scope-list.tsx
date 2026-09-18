/** One scope row: Material icon plus Google's own copy for the scope. */

import { For } from 'solid-js';

import type { IconName } from './icon';
import { Icon } from './icon';

const LABEL: Record<string, string> = {
  openid: 'Associate you with your personal info on Google',
  email: 'See your primary Google Account email address',
  profile:
    'See your personal info, including any that you have made publicly available',
};

const ICON: Record<string, IconName> = {
  openid: 'user',
  email: 'mail',
  profile: 'info',
};

export function ScopeList(props: { readonly scopes: readonly string[] }) {
  return (
    <ul class="flex flex-col gap-4">
      <For each={props.scopes}>
        {(scope) => (
          <li class="flex items-center gap-4 text-sm text-gm-on-surface-variant">
            <Icon name={ICON[scope] ?? 'info'} class="size-5" />
            <span>{LABEL[scope] ?? scope}</span>
          </li>
        )}
      </For>
    </ul>
  );
}
