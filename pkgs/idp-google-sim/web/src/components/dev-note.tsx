/**
 * The local-credentials note. A real provider never prints its account list or
 * its password; a simulator has to, or nobody can sign in.
 */

import { For, Show } from 'solid-js';

import { IDP_TEST_IDS } from '../../../src/shared/test-ids';
import { IDP_PASSWORD, type IdpAccount } from '../../../src/shared/types';
import { Icon } from './icon';

export function DevNote(props: { readonly accounts: readonly IdpAccount[] }) {
  return (
    <Show when={props.accounts.length > 0}>
      <aside
        class="mt-4 flex flex-col gap-2 rounded-lg bg-idp-hover px-4 py-3 text-xs text-idp-on-surface-variant"
        data-testid={IDP_TEST_IDS.identifierAccounts}
      >
        <p class="flex items-center gap-2">
          <Icon name="info" class="size-4" />
          <span>
            Local simulator accounts — every one uses the password{' '}
            <code>{IDP_PASSWORD}</code>.
          </span>
        </p>
        <ul class="list-disc pl-8">
          <For each={props.accounts}>
            {(account) => <li>{account.email}</li>}
          </For>
        </ul>
      </aside>
    </Show>
  );
}
