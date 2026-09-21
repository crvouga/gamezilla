/** Consent: what the app asked for, and a Cancel / Continue decision. */

import { Button } from '@pkgs/ui/components/button';

import { IDP_BRAND } from '../../../src/shared/brand';
import { IDP_AUTHORIZE_SUBMIT_PATH } from '../../../src/shared/paths';
import {
  backHrefOf,
  type IdpScreenStateOf,
  type ScreenActions,
} from '../../../src/shared/screen-state';
import { IDP_TEST_IDS } from '../../../src/shared/test-ids';
import { AccountChip } from '../components/account-chip';
import { Page, PageHeading } from '../components/page';
import { ScopeList } from '../components/scope-list';

type Props = {
  readonly state: IdpScreenStateOf<'consent'>;
  readonly actions: ScreenActions;
  readonly busy: boolean;
};

export function ConsentScreen(props: Props) {
  const submit = (event: Event): void => {
    event.preventDefault();
    const pressed = (event as SubmitEvent).submitter;
    const decision =
      pressed instanceof HTMLButtonElement && pressed.value === 'deny'
        ? 'deny'
        : 'allow';
    void props.actions.submitConsent(decision);
  };
  return (
    <Page
      testId={IDP_TEST_IDS.consentPage}
      backHref={backHrefOf(props.state)}
      open={props.actions.openDocument}
    >
      <PageHeading
        title={`${props.state.appName} wants access to your ${IDP_BRAND.name} account`}
      />
      <AccountChip account={props.state.account} />
      <p class="text text-text-secondary">
        This will allow {props.state.appName} to:
      </p>
      <ScopeList scopes={props.state.scopes} />
      <form method="post" action={IDP_AUTHORIZE_SUBMIT_PATH} onSubmit={submit}>
        <input type="hidden" name="request_id" value={props.state.requestId} />
        <input type="hidden" name="step" value="consent" />
        <div class="box flex-row items-center justify-between gap-4 pt-2">
          <Button
            type="submit"
            title="Cancel"
            intent="neutral"
            variant="ghost"
            name="decision"
            value="deny"
            disabled={props.busy}
            dataSet={{ testid: IDP_TEST_IDS.consentDeny }}
          />
          <Button
            type="submit"
            title="Continue"
            name="decision"
            value="allow"
            loading={props.busy}
            dataSet={{ testid: IDP_TEST_IDS.consentAllow }}
          />
        </div>
      </form>
      <p class="text textCaption">
        Make sure you trust {props.state.appName}. You may be sharing sensitive
        info with this site or app. You can always review or remove access from
        your {IDP_BRAND.name} account.
      </p>
    </Page>
  );
}
