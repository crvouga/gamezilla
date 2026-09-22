/**
 * The local-credentials note. A real provider never prints its account list or
 * its password; a simulator has to, or nobody can sign in.
 */

import { Notice } from '@pkgs/ui/components/notice';
import { For, Show } from 'solid-js';

import { IDP_TEST_IDS } from '../../../src/shared/test-ids';
import { IDP_PASSWORD, type IdpAccount } from '../../../src/shared/types';

export function DevNote(props: { readonly accounts: readonly IdpAccount[] }) {
  return (
    <Show when={props.accounts.length > 0}>
      <Notice dataSet={{ testid: IDP_TEST_IDS.identifierAccounts }}>
        <p>
          Local simulator accounts — every one uses the password{' '}
          <code>{IDP_PASSWORD}</code>.
        </p>
        <ul class="list-disc pl-5">
          <For each={props.accounts}>
            {(account) => <li>{account.email}</li>}
          </For>
        </ul>
      </Notice>
    </Show>
  );
}
