/**
 * The two questions Apple asks on an app's first authorization: which name to
 * share (prefilled, editable) and whether to share the real address or hide
 * it behind a relay. Both live in the consent form so a no-JS post, the SPA
 * and the headless walkers submit the same fields.
 */

import { Show } from 'solid-js';

import type { IdpAppleConsent } from '../../../src/shared/screen-state';
import { IDP_TEST_IDS } from '../../../src/shared/test-ids';
import '../components/jsx-attr-value';
import { FormField } from '../components/form-field';

function EmailChoice(props: {
  readonly value: 'share' | 'hide';
  readonly title: string;
  readonly address: string;
  readonly testId: string;
  readonly checked: boolean;
}) {
  return (
    <label class="box flex-row items-start gap-3 rounded-sm border border-border p-3">
      <input
        type="radio"
        name="email_choice"
        value={props.value}
        attr:checked={props.checked ? '' : undefined}
        checked={props.checked}
        data-testid={props.testId}
      />
      <span class="box gap-0.5">
        <span class="text textLabel">{props.title}</span>
        <span class="text textCaption break-all">{props.address}</span>
      </span>
    </label>
  );
}

export function AppleConsentFields(props: { readonly apple: IdpAppleConsent }) {
  return (
    <div class="box gap-4">
      <Show when={props.apple.nameRequested}>
        <div class="box gap-3">
          <FormField
            testId={IDP_TEST_IDS.consentGivenName}
            name="given_name"
            label="First name"
            value={props.apple.givenName}
            autocomplete="given-name"
          />
          <FormField
            testId={IDP_TEST_IDS.consentFamilyName}
            name="family_name"
            label="Last name"
            value={props.apple.familyName}
            autocomplete="family-name"
          />
        </div>
      </Show>
      <Show when={props.apple.emailRequested}>
        <fieldset class="box gap-2">
          <legend class="text textLabel pb-1">Email address</legend>
          <EmailChoice
            value="share"
            title="Share My Email"
            address={props.apple.shareEmail}
            testId={IDP_TEST_IDS.consentShareEmail}
            checked
          />
          <EmailChoice
            value="hide"
            title="Hide My Email"
            address={`Forward to: ${props.apple.relayEmail}`}
            testId={IDP_TEST_IDS.consentHideEmail}
            checked={false}
          />
        </fieldset>
      </Show>
    </div>
  );
}
