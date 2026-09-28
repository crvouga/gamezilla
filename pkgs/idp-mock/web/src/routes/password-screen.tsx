/** Step 2 — the password step, with the account chip and one field. */

import { Button } from '@pkgs/ui/components/button';
import { Checkbox } from '@pkgs/ui/components/checkbox';
import { Notice } from '@pkgs/ui/components/notice';
import { createSignal, Show } from 'solid-js';

import { IDP_AUTHORIZE_SUBMIT_PATH } from '../../../src/shared/paths';
import {
  backHrefOf,
  type IdpScreenStateOf,
  type ScreenActions,
} from '../../../src/shared/screen-state';
import { IDP_TEST_IDS } from '../../../src/shared/test-ids';
import { IDP_PASSWORD } from '../../../src/shared/types';
import { AccountChip } from '../components/account-chip';
import { FormField } from '../components/form-field';
import { FieldHint, Page, PageHeading } from '../components/page';
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
    <Page
      testId={IDP_TEST_IDS.passwordPage}
      backHref={backHrefOf(props.state)}
      open={props.actions.openDocument}
    >
      <PageHeading title="Welcome" />
      <AccountChip account={props.state.account} />
      <form
        class="box gap-4"
        method="post"
        action={IDP_AUTHORIZE_SUBMIT_PATH}
        onSubmit={submit}
      >
        <input type="hidden" name="request_id" value={props.state.requestId} />
        <input type="hidden" name="step" value="password" />
        <FormField
          testId={IDP_TEST_IDS.passwordInput}
          name="password"
          label="Password"
          secure={!show()}
          autocomplete="current-password"
          invalid={invalid()}
          describedBy={invalid() ? ERROR_ID : HINT_ID}
        />
        <Checkbox
          checked={show()}
          onToggle={setShow}
          label="Show password"
          dataSet={{ testid: IDP_TEST_IDS.passwordShow }}
        />
        <FieldHint id={HINT_ID}>
          Forgot password? Local harness: the password is{' '}
          <code>{IDP_PASSWORD}</code>.
        </FieldHint>
        <Show when={props.state.error}>
          {(error) => (
            <Notice tone="error" id={ERROR_ID} dataSet={{ testid: ERROR_ID }}>
              {error()}
            </Notice>
          )}
        </Show>
        <div class="box flex-row justify-end pt-2">
          <Button
            type="submit"
            title="Next"
            loading={props.busy}
            dataSet={{ testid: IDP_TEST_IDS.passwordNext }}
          />
        </div>
      </form>
    </Page>
  );
}
