/** The third way in: create an account inline. No password field. */

import { Button } from '@pkgs/ui/components/button';
import { Notice } from '@pkgs/ui/components/notice';
import { TextLink } from '@pkgs/ui/components/text-link';
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
import { FormField } from '../components/form-field';
import { FieldHint, Page, PageHeading } from '../components/page';
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
  const describedBy = (): string => (invalid() ? ERROR_ID : HINT_ID);
  const submit = (event: Event): void => {
    event.preventDefault();
    void props.actions.submitCreateAccount(
      fieldValueOf(event, 'name'),
      fieldValueOf(event, 'email')
    );
  };
  return (
    <Page
      testId={IDP_TEST_IDS.createAccountPage}
      backHref={back()}
      open={props.actions.openDocument}
    >
      <PageHeading
        title={`Create your ${IDP_BRAND.name} account`}
        subtitle={`to continue to ${props.state.appName}`}
      />
      <form
        class="box gap-4"
        method="post"
        action={IDP_AUTHORIZE_SUBMIT_PATH}
        onSubmit={submit}
      >
        <input type="hidden" name="request_id" value={props.state.requestId} />
        <input type="hidden" name="step" value="create" />
        <FormField
          testId={IDP_TEST_IDS.createAccountName}
          name="name"
          label="Full name"
          value={props.state.name}
          autocomplete="name"
          invalid={invalid()}
          describedBy={describedBy()}
        />
        <FormField
          testId={IDP_TEST_IDS.createAccountEmail}
          name="email"
          label="Email"
          value={props.state.email}
          autocomplete="email"
          inputmode="email"
          invalid={invalid()}
          describedBy={describedBy()}
        />
        <FieldHint id={HINT_ID}>
          This simulator always uses the password <code>{IDP_PASSWORD}</code>{' '}
          for local accounts.
        </FieldHint>
        <Show when={props.state.error}>
          {(error) => (
            <Notice tone="error" id={ERROR_ID} dataSet={{ testid: ERROR_ID }}>
              {error()}
            </Notice>
          )}
        </Show>
        <div class="box flex-row items-center justify-end gap-4 pt-2">
          <Show when={back()}>
            {(href) => (
              <TextLink
                href={href()}
                onClick={() => props.actions.openDocument(href())}
              >
                Sign in instead
              </TextLink>
            )}
          </Show>
          <Button
            type="submit"
            title="Create account"
            loading={props.busy}
            dataSet={{ testid: IDP_TEST_IDS.createAccountSubmit }}
          />
        </div>
      </form>
    </Page>
  );
}
