/**
 * Consent: what the app asked for, and a Cancel / Continue decision.
 *
 * Google shows the scope list once per new scope set. Apple asks on every
 * sign-in — the first time with the name and email questions
 * ({@link AppleConsentFields}), afterwards as a bare "continue with this
 * account" confirmation.
 */

import { Button } from '@pkgs/ui/components/button';
import { Show } from 'solid-js';

import { IDP_BRAND } from '../../../src/shared/brand';
import { IDP_AUTHORIZE_SUBMIT_PATH } from '../../../src/shared/paths';
import {
  backHrefOf,
  type IdpConsentDetails,
  type IdpScreenStateOf,
  type ScreenActions,
} from '../../../src/shared/screen-state';
import { IDP_TEST_IDS } from '../../../src/shared/test-ids';
import type { IdpProviderKind } from '../../../src/shared/types';
import { AccountChip } from '../components/account-chip';
import { Page, PageHeading } from '../components/page';
import { ScopeList } from '../components/scope-list';
import { checkedValueOf, fieldValueOf } from '../dom';
import { AppleConsentFields } from './apple-consent-fields';

type Props = {
  readonly state: IdpScreenStateOf<'consent'>;
  readonly provider: IdpProviderKind;
  readonly actions: ScreenActions;
  readonly busy: boolean;
};

function detailsOf(event: Event): IdpConsentDetails {
  return {
    givenName: fieldValueOf(event, 'given_name'),
    familyName: fieldValueOf(event, 'family_name'),
    emailChoice:
      checkedValueOf(event, 'email_choice') === 'hide' ? 'hide' : 'share',
  };
}

function headingOf(props: Props): string {
  const apple = props.state.apple;
  if (apple === null) {
    return `${props.state.appName} wants access to your ${IDP_BRAND.name} account`;
  }
  return apple.firstAuthorization
    ? `Create an account for ${props.state.appName} using your ${IDP_BRAND.name} account`
    : `Continue to ${props.state.appName} with your ${IDP_BRAND.name} account?`;
}

export function ConsentScreen(props: Props) {
  const firstApple = (): boolean =>
    props.state.apple?.firstAuthorization === true;
  const submit = (event: Event): void => {
    event.preventDefault();
    const pressed = (event as SubmitEvent).submitter;
    const decision =
      pressed instanceof HTMLButtonElement && pressed.value === 'deny'
        ? 'deny'
        : 'allow';
    void props.actions.submitConsent(
      decision,
      firstApple() ? detailsOf(event) : null
    );
  };
  return (
    <Page
      testId={IDP_TEST_IDS.consentPage}
      backHref={backHrefOf(props.state)}
      open={props.actions.openDocument}
    >
      <PageHeading title={headingOf(props)} />
      <AccountChip account={props.state.account} />
      <Show when={props.state.apple === null && props.state.scopes.length > 0}>
        <p class="text text-text-secondary">
          This will allow {props.state.appName} to:
        </p>
        <ScopeList scopes={props.state.scopes} provider={props.provider} />
      </Show>
      <form method="post" action={IDP_AUTHORIZE_SUBMIT_PATH} onSubmit={submit}>
        <input type="hidden" name="request_id" value={props.state.requestId} />
        <input type="hidden" name="step" value="consent" />
        <Show when={firstApple() ? props.state.apple : null}>
          {(apple) => <AppleConsentFields apple={apple()} />}
        </Show>
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
