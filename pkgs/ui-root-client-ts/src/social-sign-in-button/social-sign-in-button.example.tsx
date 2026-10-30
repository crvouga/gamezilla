/** @jsxImportSource solid-js */
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { SocialSignInButton } from '@pkgs/ui-root-client-ts/social-sign-in-button';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const LOADING_DEMO_MS = 1500;

function SocialSignInDemo(): JSX.Element {
  const timers = useTimers();
  const [loading, setLoading] = createSignal(false);

  const handleClick = (): void => {
    setLoading(true);
    timers.setTimeout(() => setLoading(false), LOADING_DEMO_MS);
  };

  return (
    <>
      <GoogleExamples onClick={handleClick} loading={loading()} />
      <DevExamples onClick={handleClick} />
    </>
  );
}

export default function SocialSignInButtonExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SocialSignInDemo />
    </ExampleRoot>
  );
}

function GoogleExamples(props: {
  onClick: () => void;
  loading: boolean;
}): JSX.Element {
  return (
    <>
      <div class="box flex-col gap-3">
        <label class="text textLabel">
          {'Google · Light · Rectangular (default)'}
        </label>
        <SocialSignInButton provider="google" onClick={props.onClick} />
      </div>
      <div class="box flex-col gap-3">
        <label class="text textLabel">{'Google · Light · Pill'}</label>
        <SocialSignInButton
          provider="google"
          shape="pill"
          onClick={props.onClick}
        />
      </div>
      <div class="box flex-col gap-3">
        <label class="text textLabel">{'Google · Dark · Pill · Sign in'}</label>
        <SocialSignInButton
          provider="google"
          theme="dark"
          shape="pill"
          action="signIn"
          onClick={props.onClick}
        />
      </div>
      <div class="box flex-col gap-3">
        <label class="text textLabel">
          {'Google · Neutral · Rectangular · Sign up'}
        </label>
        <SocialSignInButton
          provider="google"
          theme="neutral"
          action="signUp"
          onClick={props.onClick}
        />
      </div>
      <div class="box flex-col gap-3">
        <label class="text textLabel">{'Loading state'}</label>
        <SocialSignInButton
          provider="google"
          loading={props.loading}
          onClick={props.onClick}
        />
      </div>
      <div class="box flex-col gap-3">
        <label class="text textLabel">{'Disabled'}</label>
        <SocialSignInButton
          provider="google"
          disabled
          onClick={props.onClick}
        />
      </div>
    </>
  );
}

function DevExamples(props: { onClick: () => void }): JSX.Element {
  return (
    <>
      <div class="box flex-col gap-3">
        <label class="text textLabel">{'Dev IdP · Light · Rectangular'}</label>
        <SocialSignInButton provider="dev" onClick={props.onClick} />
      </div>
      <div class="box flex-col gap-3">
        <label class="text textLabel">
          {'Dev IdP · Dark · Pill · Sign in'}
        </label>
        <SocialSignInButton
          provider="dev"
          theme="dark"
          shape="pill"
          action="signIn"
          onClick={props.onClick}
        />
      </div>
      <div class="box flex-col gap-3">
        <label class="text textLabel">
          {'Dev IdP · Neutral · Rectangular'}
        </label>
        <SocialSignInButton
          provider="dev"
          theme="neutral"
          onClick={props.onClick}
        />
      </div>
    </>
  );
}
