import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { H2 } from '@pkgs/ui-root-client/heading';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { P } from '@pkgs/ui-root-client/text';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import { type JSX, Match, Show, Switch } from 'solid-js';
import type { EmailSignInForm as EmailSignInFormState } from './use-email-sign-in';

/** The two faces of the emailed-link form: the address, then the link. */
export function EmailSignInForm(props: {
  form: EmailSignInFormState;
}): JSX.Element {
  return (
    <StackVertical gap="md">
      <Switch>
        <Match when={props.form.step() === 'address'}>
          <EmailAddressStep form={props.form} />
        </Match>
        <Match when={props.form.step() === 'link'}>
          <EmailLinkStep form={props.form} />
        </Match>
      </Switch>
    </StackVertical>
  );
}

function EmailAddressStep(props: { form: EmailSignInFormState }): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <TextInput
        type="email"
        label={t`Email address`}
        value={props.form.address()}
        onChangeText={props.form.setAddress}
        autocomplete="email"
        dataSet={{ testid: Handles.authEmailAddress }}
      />
      <Button
        {...props.form.request.buttonProps}
        dataSet={{ testid: Handles.authEmailRequestLink }}
      />
      <Show when={props.form.request.error()}>
        {(error) => (
          <P variant="caption" tone="destructive" role="alert">
            {error().message}
          </P>
        )}
      </Show>
    </>
  );
}

function EmailLinkStep(props: { form: EmailSignInFormState }): JSX.Element {
  const { t } = useLingui();
  // Says the same whether or not a link was sent: it never tells who has an account.
  const checkYourEmail = (): string => {
    const address = props.form.address().trim();
    return t`If ${address} can sign in here, a sign-in link is on its way. Paste it below.`;
  };
  return (
    <>
      <H2 size="label">
        <Trans>Check your email</Trans>
      </H2>
      <P tone="secondary">{checkYourEmail()}</P>
      <TextInput
        label={t`Sign-in link`}
        value={props.form.link()}
        onChangeText={props.form.setLink}
        onSubmitEditing={props.form.signIn}
        autocomplete="off"
        dataSet={{ testid: Handles.authEmailLink }}
      />
      <Button
        title={t`Sign in`}
        disabled={!props.form.linkPresent()}
        onClick={props.form.signIn}
        dataSet={{ testid: Handles.authEmailSignIn }}
      />
      <Button
        title={t`Use a different email address`}
        variant="ghost"
        intent="neutral"
        onClick={props.form.changeAddress}
        dataSet={{ testid: Handles.authEmailChangeAddress }}
      />
    </>
  );
}
