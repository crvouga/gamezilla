import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import { type JSX, Show } from 'solid-js';
import { usePasswordSignIn } from './use-password-sign-in';

export function PasswordSignInForm(props: {
  start: (runner: () => Promise<void>) => Promise<void>;
  pendingLink: string | null;
}): JSX.Element {
  const { t } = useLingui();
  const form = usePasswordSignIn(props);
  return (
    <div class="box gap-3" data-component="PasswordSignInForm">
      <p class="text textLabel">
        <Trans>Email address and password</Trans>
      </p>
      <TextInput
        type="email"
        label={t`Email address`}
        value={form.email()}
        onChangeText={form.setEmail}
        autocomplete="email"
        dataSet={{ testid: 'auth-password-email' }}
      />
      <TextInput
        secureTextEntry
        label={t`Password`}
        value={form.password()}
        onChangeText={form.setPassword}
        autocomplete="current-password"
        helperText={t`Use 15 to 128 characters.`}
        dataSet={{ testid: 'auth-password-secret' }}
      />
      <Button
        {...form.signIn.buttonProps}
        disabled={
          !form.valid() ||
          form.signIn.feedback() === 'loading' ||
          form.register.feedback() === 'loading'
        }
        dataSet={{ testid: 'auth-password-sign-in' }}
      />
      <Show when={props.pendingLink === null}>
        <Button
          {...form.register.buttonProps}
          disabled={
            !form.valid() ||
            form.signIn.feedback() === 'loading' ||
            form.register.feedback() === 'loading'
          }
          dataSet={{ testid: 'auth-password-register' }}
        />
      </Show>
      <Show when={form.signIn.error() ?? form.register.error()}>
        {(error) => (
          <p class="text textCaption text-destructive" role="alert">
            {error().message}
          </p>
        )}
      </Show>
    </div>
  );
}
