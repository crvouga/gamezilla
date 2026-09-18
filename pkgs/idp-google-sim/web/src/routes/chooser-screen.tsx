/**
 * The account chooser. Rows are real submit buttons carrying `sub`, so the
 * no-JS form and the headless walkers take the same path as the SPA; the arrow
 * keys only move focus, and `role="group"` (never `role="listbox"`, which would
 * demand `role="option"` children) keeps the button contract intact.
 */

import { For } from 'solid-js';

import {
  IDP_AUTHORIZE_CREATE_PATH,
  IDP_AUTHORIZE_SUBMIT_PATH,
} from '../../../src/shared/paths';
import {
  backHrefOf,
  type IdpScreenStateOf,
  type ScreenActions,
} from '../../../src/shared/screen-state';
import { IDP_TEST_IDS } from '../../../src/shared/test-ids';
import { AccountRow } from '../components/account-row';
import { Card } from '../components/card';
import { Icon } from '../components/icon';
import { moveRovingFocus } from '../dom';

type Props = {
  readonly state: IdpScreenStateOf<'chooser'>;
  readonly actions: ScreenActions;
  readonly busy: boolean;
};

const HEADING_ID = 'idp-chooser-heading';

export function ChooserScreen(props: Props) {
  const createHref = (): string =>
    `${IDP_AUTHORIZE_CREATE_PATH}?request_id=${encodeURIComponent(props.state.requestId)}`;
  const submit = (event: Event): void => {
    event.preventDefault();
    const chosen = (event as SubmitEvent).submitter;
    void props.actions.submitChoose(
      chosen instanceof HTMLButtonElement ? chosen.value : ''
    );
  };
  return (
    <Card
      testId={IDP_TEST_IDS.chooserPage}
      backHref={backHrefOf(props.state)}
      open={props.actions.openDocument}
    >
      <h1 id={HEADING_ID} class="text-2xl leading-8 font-normal">
        Choose an account
      </h1>
      <p class="text-base text-gm-on-surface-variant">
        to continue to {props.state.appName}
      </p>
      <form
        class="mt-2 flex flex-col gap-1"
        method="post"
        action={IDP_AUTHORIZE_SUBMIT_PATH}
        onSubmit={submit}
        onKeyDown={(event) => moveRovingFocus(event, event.currentTarget)}
        role="group"
        aria-labelledby={HEADING_ID}
      >
        <input type="hidden" name="request_id" value={props.state.requestId} />
        <input type="hidden" name="step" value="choose" />
        <For each={props.state.accounts}>
          {(account) => (
            <AccountRow
              account={account}
              testId={IDP_TEST_IDS.chooserAccount(account.sub)}
            />
          )}
        </For>
        <hr class="my-2 border-gm-divider" />
        <button
          class="flex min-h-14 w-full items-center gap-4 rounded-lg px-3 py-2 text-left text-sm text-gm-on-surface hover:bg-gm-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gm-primary"
          type="submit"
          name="sub"
          value=""
          data-testid={IDP_TEST_IDS.chooserUseAnother}
        >
          <span
            class="grid size-8 shrink-0 place-items-center rounded-full bg-gm-hover"
            aria-hidden="true"
          >
            <Icon name="plus" class="size-4" />
          </span>
          Use another account
        </button>
      </form>
      <a
        class="flex min-h-14 items-center gap-4 rounded-lg px-3 text-sm text-gm-on-surface hover:bg-gm-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gm-primary"
        href={createHref()}
        rel="external"
        onClick={(event) => {
          event.preventDefault();
          props.actions.openDocument(createHref());
        }}
        data-testid={IDP_TEST_IDS.chooserCreateAccount}
      >
        <span
          class="grid size-8 shrink-0 place-items-center rounded-full bg-gm-hover"
          aria-hidden="true"
        >
          <Icon name="user-plus" class="size-4" />
        </span>
        Create account
      </a>
      <p class="mt-2 text-xs text-gm-on-surface-variant">
        To continue, Google will share your name, email address, and profile
        picture with {props.state.appName}.
      </p>
    </Card>
  );
}
