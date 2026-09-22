/** Step 1 — the address step: who is signing in. */

import { Button } from '@pkgs/ui/components/button';
import { Notice } from '@pkgs/ui/components/notice';
import { TextLink } from '@pkgs/ui/components/text-link';
import { For, Show } from 'solid-js';

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
import { DevNote } from '../components/dev-note';
import { FormField } from '../components/form-field';
import { FieldHint, Page, PageHeading } from '../components/page';
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
    <Page
      testId={IDP_TEST_IDS.identifierPage}
      backHref={backHrefOf(props.state)}
      open={props.actions.openDocument}
    >
      <PageHeading
        title="Sign in"
        subtitle={`to continue to ${props.state.appName}`}
      />
      <form
        class="box gap-4"
        method="post"
        action={IDP_AUTHORIZE_SUBMIT_PATH}
        onSubmit={submit}
      >
        <input type="hidden" name="request_id" value={props.state.requestId} />
        <input type="hidden" name="step" value="identifier" />
        <FormField
          testId={IDP_TEST_IDS.identifierEmail}
          name="email"
          label="Email or phone"
          value={props.state.email}
          autocomplete="username"
          inputmode="email"
          invalid={invalid()}
          describedBy={invalid() ? ERROR_ID : HINT_ID}
          list={IDP_TEST_IDS.identifierAccountsDatalist}
        />
        <FieldHint id={HINT_ID}>
          Any address from the local directory below, or one you create here.
        </FieldHint>
        <Show when={props.state.error}>
          {(error) => (
            <Notice tone="error" id={ERROR_ID} dataSet={{ testid: ERROR_ID }}>
              {error()}
            </Notice>
          )}
        </Show>
        <div class="box flex-row items-center justify-between gap-4 pt-2">
          <TextLink
            href={createHref()}
            onClick={() => props.actions.openDocument(createHref())}
            dataSet={{ testid: IDP_TEST_IDS.identifierCreateAccount }}
          >
            Create account
          </TextLink>
          <Button
            type="submit"
            title="Next"
            loading={props.busy}
            dataSet={{ testid: IDP_TEST_IDS.identifierNext }}
          />
        </div>
      </form>
      <datalist id={IDP_TEST_IDS.identifierAccountsDatalist}>
        <For each={props.state.accounts}>
          {(account) => <option value={account.email} label={account.name} />}
        </For>
      </datalist>
      <DevNote accounts={props.state.accounts} />
    </Page>
  );
}
