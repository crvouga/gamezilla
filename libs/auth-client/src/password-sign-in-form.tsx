import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import { createSignal, type JSX, Show } from 'solid-js';
import { useAuthClientPort } from './auth-client-provider';

export function PasswordSignInForm(props: {
  start: (runner: () => Promise<void>) => Promise<void>;
  pendingLink: string | null;
}): JSX.Element {
  const { t } = useLingui();
  const port = useAuthClientPort();
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const valid = () =>
    email().includes('@') &&
    password().length >= 15 &&
    password().length <= 128;
  const authenticate = async (registering: boolean) => {
    const address = email();
    const secret = password();
    setPassword('');
    await props.start(() =>
      registering
        ? port.registerWithPassword(address, secret)
        : port.signInWithPassword(
            address,
            secret,
            props.pendingLink === null ? {} : { pendingLink: props.pendingLink }
          )
    );
  };
  const signIn = useMutationButton({
    labels: {
      idle: t`Sign in`,
      loading: t`Signing in…`,
      success: t`Signed in`,
      error: t`Try again`,
    },
    get disabled() {
      return !valid();
    },
    operation: () => authenticate(false),
  });
  const register = useMutationButton({
    labels: {
      idle: t`Create account`,
      loading: t`Creating…`,
      success: t`Created`,
      error: t`Try again`,
    },
    get disabled() {
      return !valid();
    },
    operation: () => authenticate(true),
  });
  return (
    <div class="box gap-3" data-component="PasswordSignInForm">
      <p class="text textLabel">
        <Trans>Email address and password</Trans>
      </p>
      <TextInput
        type="email"
        label={t`Email address`}
        value={email()}
        onChangeText={setEmail}
        autocomplete="email"
        dataSet={{ testid: 'auth-password-email' }}
      />
      <TextInput
        secureTextEntry
        label={t`Password`}
        value={password()}
        onChangeText={setPassword}
        autocomplete="current-password"
        helperText={t`Use 15 to 128 characters.`}
        dataSet={{ testid: 'auth-password-secret' }}
      />
      <Button
        {...signIn.buttonProps}
        disabled={
          !valid() ||
          signIn.feedback() === 'loading' ||
          register.feedback() === 'loading'
        }
        dataSet={{ testid: 'auth-password-sign-in' }}
      />
      <Show when={props.pendingLink === null}>
        <Button
          {...register.buttonProps}
          disabled={
            !valid() ||
            signIn.feedback() === 'loading' ||
            register.feedback() === 'loading'
          }
          dataSet={{ testid: 'auth-password-register' }}
        />
      </Show>
      <Show when={signIn.error() ?? register.error()}>
        {(error) => (
          <p class="text textCaption text-destructive" role="alert">
            {error().message}
          </p>
        )}
      </Show>
    </div>
  );
}
