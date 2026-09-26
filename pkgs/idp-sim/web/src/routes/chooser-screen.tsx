/**
 * The account chooser. Rows are real submit buttons carrying `sub`, so the
 * no-JS form and the headless walkers take the same path as the SPA; the arrow
 * keys only move focus, and `role="group"` (never `role="listbox"`, which would
 * demand `role="option"` children) keeps the button contract intact.
 */

import { Avatar } from '@pkgs/ui/components/avatar';
import { PlusIcon, UserPlusIcon } from '@pkgs/ui/components/icons';
import { MenuRow } from '@pkgs/ui/components/menu-row';
import { For } from 'solid-js';

import { IDP_BRAND } from '../../../src/shared/brand';
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
import { AccountAvatar } from '../components/account-chip';
import { Page, PageHeading } from '../components/page';
import { moveRovingFocus } from '../dom';

type Props = {
  readonly state: IdpScreenStateOf<'chooser'>;
  readonly actions: ScreenActions;
  readonly busy: boolean;
};

const HEADING_ID = 'idp-chooser-heading';
const ROW_AVATAR_SIZE = 32;

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
    <Page
      testId={IDP_TEST_IDS.chooserPage}
      backHref={backHrefOf(props.state)}
      open={props.actions.openDocument}
    >
      <PageHeading
        id={HEADING_ID}
        title="Choose an account"
        subtitle={`to continue to ${props.state.appName}`}
      />
      <div class="box -mx-2">
        <form
          class="box gap-1"
          method="post"
          action={IDP_AUTHORIZE_SUBMIT_PATH}
          onSubmit={submit}
          onKeyDown={(event) => moveRovingFocus(event, event.currentTarget)}
          role="group"
          aria-labelledby={HEADING_ID}
        >
          <input
            type="hidden"
            name="request_id"
            value={props.state.requestId}
          />
          <input type="hidden" name="step" value="choose" />
          <For each={props.state.accounts}>
            {(account) => (
              <MenuRow
                submit={{ name: 'sub', value: account.sub }}
                title={account.name}
                caption={account.email}
                leading={<AccountAvatar account={account} />}
                hideChevron
                disabled={props.busy}
                dataSet={{ testid: IDP_TEST_IDS.chooserAccount(account.sub) }}
              />
            )}
          </For>
          <hr class="my-1 border-border" />
          <MenuRow
            submit={{ name: 'sub', value: '' }}
            title="Use another account"
            leading={
              <Avatar
                icon={PlusIcon}
                size={ROW_AVATAR_SIZE}
                background="surfaceMuted"
              />
            }
            hideChevron
            disabled={props.busy}
            dataSet={{ testid: IDP_TEST_IDS.chooserUseAnother }}
          />
        </form>
        <MenuRow
          href={createHref()}
          onClick={() => props.actions.openDocument(createHref())}
          title="Create account"
          leading={
            <Avatar
              icon={UserPlusIcon}
              size={ROW_AVATAR_SIZE}
              background="surfaceMuted"
            />
          }
          hideChevron
          dataSet={{ testid: IDP_TEST_IDS.chooserCreateAccount }}
        />
      </div>
      <p class="text textCaption">
        To continue, {IDP_BRAND.name} will share your name, email address, and
        profile picture with {props.state.appName}.
      </p>
    </Page>
  );
}
