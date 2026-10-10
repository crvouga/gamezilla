import { useLingui } from '@lingui/solid/macro';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import { createSignal } from 'solid-js';
import { useAuthClientPort } from './auth-client-provider';

export function usePasswordSignIn(props: {
  start: (runner: () => Promise<void>) => Promise<void>;
  pendingLink: string | null;
}) {
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
    const pendingLink = props.pendingLink;
    await props.start(() =>
      registering
        ? port.registerWithPassword(address, secret)
        : port.signInWithPassword(
            address,
            secret,
            pendingLink === null ? {} : { pendingLink }
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
  return { email, setEmail, password, setPassword, valid, signIn, register };
}
