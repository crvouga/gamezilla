/** The third way in: create an account inline. No password field. */

import { Show } from 'solid-js';

import { IDP_BRAND } from '../../../src/shared/brand';
import { IDP_AUTHORIZE_SUBMIT_PATH } from '../../../src/shared/paths';
import {
  backHrefOf,
  type IdpScreenStateOf,
  type ScreenActions,
} from '../../../src/shared/screen-state';
import { IDP_TEST_IDS } from '../../../src/shared/test-ids';
import { IDP_PASSWORD } from '../../../src/shared/types';
import { Button } from '../components/button';
import { Card } from '../components/card';
import { ErrorNote } from '../components/error-note';
import { TextField } from '../components/text-field';
import { fieldValueOf } from '../dom';

type Props = {
  readonly state: IdpScreenStateOf<'create-account'>;
  readonly actions: ScreenActions;
  readonly busy: boolean;
};

const HINT_ID = IDP_TEST_IDS.createAccountPassword;
const ERROR_ID = IDP_TEST_IDS.createAccountError;

export function CreateAccountScreen(props: Props) {
  const invalid = (): boolean => props.state.error !== null;
  const back = (): string | null => backHrefOf(props.state);
  const submit = (event: Event): void => {
    event.preventDefault();
    void props.actions.submitCreateAccount(
      fieldValueOf(event, 'name'),
      fieldValueOf(event, 'email')
    );
  };
  return (
    <Card
      testId={IDP_TEST_IDS.createAccountPage}
      backHref={back()}
      open={props.actions.openDocument}
    >
      <h1 class="text-2xl leading-8 font-normal">
        Create your {IDP_BRAND.name} account
      </h1>
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
        <input type="hidden" name="step" value="create" />
        <TextField
          testId={IDP_TEST_IDS.createAccountName}
          name="name"
          label="Full name"
          value={props.state.name}
          autocomplete="name"
          autofocus={invalid()}
          invalid={invalid()}
          describedBy={invalid() ? ERROR_ID : HINT_ID}
        />
        <TextField
          testId={IDP_TEST_IDS.createAccountEmail}
          name="email"
          label="Email"
          value={props.state.email}
          autocomplete="email"
          inputmode="email"
          invalid={invalid()}
          describedBy={invalid() ? ERROR_ID : HINT_ID}
        />
        <p id={HINT_ID} class="text-xs text-idp-on-surface-variant">
          This simulator always uses the password <code>{IDP_PASSWORD}</code>{' '}
          for local accounts.
        </p>
        {invalid() ? (
          <ErrorNote id={ERROR_ID} testId={ERROR_ID}>
            {props.state.error ?? ''}
          </ErrorNote>
        ) : null}
        <div class="mt-2 flex items-center justify-end gap-4">
          <Show when={back()}>
            {(href) => (
              <a
                class="rounded text-sm font-medium text-idp-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-idp-primary"
                href={href()}
                rel="external"
                onClick={(event) => {
                  event.preventDefault();
                  props.actions.openDocument(href());
                }}
              >
                Sign in instead
              </a>
            )}
          </Show>
          <Button
            label="Create account"
            testId={IDP_TEST_IDS.createAccountSubmit}
            busy={props.busy}
          />
        </div>
      </form>
    </Card>
  );
}
