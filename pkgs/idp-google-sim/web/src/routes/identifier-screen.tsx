/** Step 1 — the address step: who is signing in. */

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
import { Button } from '../components/button';
import { Card } from '../components/card';
import { DevNote } from '../components/dev-note';
import { ErrorNote } from '../components/error-note';
import { TextField } from '../components/text-field';
import { fieldValueOf } from '../dom';

type Props = {
  readonly state: IdpScreenStateOf<'identifier'>;
  readonly actions: ScreenActions;
  readonly busy: boolean;
};

const HINT_ID = 'idp-identifier-hint';
const ERROR_ID = IDP_TEST_IDS.identifierError;

export function IdentifierScreen(props: Props) {
  const invalid = (): boolean => props.state.error !== null;
  const createHref = (): string =>
    `${IDP_AUTHORIZE_CREATE_PATH}?request_id=${encodeURIComponent(props.state.requestId)}`;
  const submit = (event: Event): void => {
    event.preventDefault();
    void props.actions.submitIdentifier(fieldValueOf(event, 'email'));
  };
  return (
    <Card
      testId={IDP_TEST_IDS.identifierPage}
      backHref={backHrefOf(props.state)}
      open={props.actions.openDocument}
    >
      <h1 class="text-2xl leading-8 font-normal">Sign in</h1>
      <p class="text-base text-idp-on-surface-variant">
        to continue to {props.state.appName}
      </p>
      <form
        class="mt-2 flex flex-col gap-4"
        method="post"
        action={IDP_AUTHORIZE_SUBMIT_PATH}
        onSubmit={submit}
      >
        <input type="hidden" name="request_id" value={props.state.requestId} />
        <input type="hidden" name="step" value="identifier" />
        <TextField
          testId={IDP_TEST_IDS.identifierEmail}
          name="email"
          label="Email or phone"
          value={props.state.email}
          autocomplete="username"
          inputmode="email"
          autofocus={invalid()}
          invalid={invalid()}
          describedBy={invalid() ? ERROR_ID : HINT_ID}
          list={IDP_TEST_IDS.identifierAccountsDatalist}
        />
        <p id={HINT_ID} class="text-xs text-idp-on-surface-variant">
          Any address from the local directory below, or one you create here.
        </p>
        {invalid() ? (
          <ErrorNote id={ERROR_ID} testId={ERROR_ID}>
            {props.state.error ?? ''}
          </ErrorNote>
        ) : null}
        <div class="mt-2 flex items-center justify-between gap-4">
          <a
            class="rounded text-sm font-medium text-idp-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-idp-primary"
            href={createHref()}
            rel="external"
            onClick={(event) => {
              event.preventDefault();
              props.actions.openDocument(createHref());
            }}
            data-testid={IDP_TEST_IDS.identifierCreateAccount}
          >
            Create account
          </a>
          <Button
            label="Next"
            testId={IDP_TEST_IDS.identifierNext}
            busy={props.busy}
          />
        </div>
      </form>
      <datalist id={IDP_TEST_IDS.identifierAccountsDatalist}>
        <For each={props.state.accounts}>
          {(account) => <option value={account.email} label={account.name} />}
        </For>
      </datalist>
      <DevNote accounts={props.state.accounts} />
    </Card>
  );
}
