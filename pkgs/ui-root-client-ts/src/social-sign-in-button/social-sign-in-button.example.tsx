/** @jsxImportSource @solidjs/web */
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { SocialSignInButton } from '@pkgs/ui-root-client-ts/social-sign-in-button';
import type { JSX } from '@solidjs/web';
import { createSignal } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const LOADING_DEMO_MS = 1500;

function SocialSignInDemo(): JSX.Element {
  const timers = useTimers();
  const [loading, setLoading] = createSignal(true);

  const handleClick = (): void => {
    setLoading(true);
    timers.setTimeout(() => setLoading(false), LOADING_DEMO_MS);
  };

  return (
    <div class="box gap-3">
      <SocialSignInButton provider="google" onClick={handleClick} />
      <SocialSignInButton
        provider="apple"
        action="signIn"
        onClick={handleClick}
      />
      <SocialSignInButton
        provider="dev"
        action="signUp"
        onClick={handleClick}
      />
      <SocialSignInButton
        provider="google"
        loading={loading()}
        onClick={handleClick}
      />
      <SocialSignInButton provider="google" disabled onClick={handleClick} />
    </div>
  );
}

export default function SocialSignInButtonExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SocialSignInDemo />
    </ExampleRoot>
  );
}
