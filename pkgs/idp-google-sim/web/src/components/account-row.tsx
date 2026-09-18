/** One row of the account chooser: a submit button carrying the subject. */

import type { IdpAccount } from '../../../src/shared/types';
import { initials } from './initials';

export function AccountRow(props: {
  readonly account: IdpAccount;
  readonly testId: string;
}) {
  return (
    <button
      class="flex min-h-14 w-full items-center gap-4 rounded-lg px-3 py-2 text-left hover:bg-gm-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gm-primary"
      type="submit"
      name="sub"
      value={props.account.sub}
      data-testid={props.testId}
    >
      <span
        class="grid size-8 shrink-0 place-items-center rounded-full bg-white text-sm font-medium text-gm-primary ring-1 ring-gm-divider"
        aria-hidden="true"
      >
        {initials(props.account.name)}
      </span>
      <span class="flex min-w-0 flex-col">
        <span class="truncate text-sm font-medium text-gm-on-surface">
          {props.account.name}
        </span>
        <span class="truncate text-sm text-gm-on-surface-variant">
          {props.account.email}
        </span>
      </span>
    </button>
  );
}
