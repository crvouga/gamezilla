/** Consent: what the app asked for, and a Cancel / Continue decision. */

import { IDP_BRAND } from '../../../src/shared/brand';
import { IDP_AUTHORIZE_SUBMIT_PATH } from '../../../src/shared/paths';
import {
  backHrefOf,
  type IdpScreenStateOf,
  type ScreenActions,
} from '../../../src/shared/screen-state';
import { IDP_TEST_IDS } from '../../../src/shared/test-ids';
import { Button } from '../components/button';
import { Card } from '../components/card';
import { initials } from '../components/initials';
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
    <Card
      testId={IDP_TEST_IDS.consentPage}
      backHref={backHrefOf(props.state)}
      open={props.actions.openDocument}
    >
      <h1 class="text-2xl leading-8 font-normal">
        {props.state.appName} wants access to your {IDP_BRAND.name} account
      </h1>
      <div class="flex items-center gap-4 text-sm text-idp-on-surface">
        <span
          class="grid size-8 shrink-0 place-items-center rounded-full bg-white font-medium text-idp-primary ring-1 ring-idp-divider"
          aria-hidden="true"
        >
          {initials(props.state.account.name)}
        </span>
        <span class="truncate">{props.state.account.email}</span>
      </div>
      <p class="text-base text-idp-on-surface-variant">
        This will allow {props.state.appName} to:
      </p>
      <ScopeList scopes={props.state.scopes} />
      <form method="post" action={IDP_AUTHORIZE_SUBMIT_PATH} onSubmit={submit}>
        <input type="hidden" name="request_id" value={props.state.requestId} />
        <input type="hidden" name="step" value="consent" />
        <div class="mt-2 flex items-center justify-between gap-4">
          <Button
            label="Cancel"
            variant="text"
            name="decision"
            value="deny"
            testId={IDP_TEST_IDS.consentDeny}
            busy={props.busy}
          />
          <Button
            label="Continue"
            name="decision"
            value="allow"
            testId={IDP_TEST_IDS.consentAllow}
            busy={props.busy}
          />
        </div>
      </form>
      <p class="text-xs text-idp-on-surface-variant">
        Make sure you trust {props.state.appName}. You may be sharing sensitive
        info with this site or app. You can always review or remove access from
        your {IDP_BRAND.name} account.
      </p>
    </Card>
  );
}
