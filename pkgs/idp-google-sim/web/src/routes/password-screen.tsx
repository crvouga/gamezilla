/** Step 2 — the password step, with the account chip and one field. */

import { createSignal } from 'solid-js';

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
import { Icon } from '../components/icon';
import { initials } from '../components/initials';
import { TextField } from '../components/text-field';
import { fieldValueOf } from '../dom';

type Props = {
  readonly state: IdpScreenStateOf<'password'>;
  readonly actions: ScreenActions;
  readonly busy: boolean;
};

const HINT_ID = 'idp-password-hint';
const ERROR_ID = IDP_TEST_IDS.passwordError;

export function PasswordScreen(props: Props) {
  const [show, setShow] = createSignal(false);
  const invalid = (): boolean => props.state.error !== null;
  const submit = (event: Event): void => {
    event.preventDefault();
    void props.actions.submitPassword(fieldValueOf(event, 'password'));
  };
  return (
    <Card
      testId={IDP_TEST_IDS.passwordPage}
      backHref={backHrefOf(props.state)}
      open={props.actions.openDocument}
    >
      <h1 class="text-2xl leading-8 font-normal">Welcome</h1>
      <div class="flex items-center gap-4">
        <span
          class="grid size-8 shrink-0 place-items-center rounded-full bg-white text-sm font-medium text-idp-primary ring-1 ring-idp-divider"
          aria-hidden="true"
        >
          {initials(props.state.account.name)}
        </span>
        <span class="truncate text-sm text-idp-on-surface">
          {props.state.account.email}
        </span>
      </div>
      <form
        class="mt-2 flex flex-col gap-4"
        method="post"
        action={IDP_AUTHORIZE_SUBMIT_PATH}
        onSubmit={submit}
      >
        <input type="hidden" name="request_id" value={props.state.requestId} />
        <input type="hidden" name="step" value="password" />
        <TextField
          testId={IDP_TEST_IDS.passwordInput}
          name="password"
          label="Password"
          type={show() ? 'text' : 'password'}
          autocomplete="current-password"
          autofocus={invalid()}
          invalid={invalid()}
          describedBy={invalid() ? ERROR_ID : HINT_ID}
        />
        <label class="flex items-center gap-2 text-sm text-idp-on-surface-variant">
          <input
            type="checkbox"
            checked={show()}
            onChange={(event) => setShow(event.currentTarget.checked)}
            data-testid={IDP_TEST_IDS.passwordShow}
          />
          <Icon name={show() ? 'eye-off' : 'eye'} class="size-4" />
          Show password
        </label>
        <p id={HINT_ID} class="text-xs text-idp-on-surface-variant">
          Forgot password? Local simulator: the password is{' '}
          <code>{IDP_PASSWORD}</code>.
        </p>
        {invalid() ? (
          <ErrorNote id={ERROR_ID} testId={ERROR_ID}>
            {props.state.error ?? ''}
          </ErrorNote>
        ) : null}
        <div class="mt-2 flex justify-end">
          <Button
            label="Next"
            testId={IDP_TEST_IDS.passwordNext}
            busy={props.busy}
          />
        </div>
      </form>
    </Card>
  );
}
