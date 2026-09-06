/** @jsxImportSource solid-js */
import { useTimers } from '@pkgs/clock/solid';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { Text } from '../text';
import { SocialSignInButton } from './social-sign-in-button';

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
      <Stack spacing={3}>
        <Text variant="label" label="Google · Light · Rectangular (default)" />
        <SocialSignInButton provider="google" onClick={props.onClick} />
      </Stack>
      <Stack spacing={3}>
        <Text variant="label" label="Google · Light · Pill" />
        <SocialSignInButton
          provider="google"
          shape="pill"
          onClick={props.onClick}
        />
      </Stack>
      <Stack spacing={3}>
        <Text variant="label" label="Google · Dark · Pill · Sign in" />
        <SocialSignInButton
          provider="google"
          theme="dark"
          shape="pill"
          action="signIn"
          onClick={props.onClick}
        />
      </Stack>
      <Stack spacing={3}>
        <Text
          variant="label"
          label="Google · Neutral · Rectangular · Sign up"
        />
        <SocialSignInButton
          provider="google"
          theme="neutral"
          action="signUp"
          onClick={props.onClick}
        />
      </Stack>
      <Stack spacing={3}>
        <Text variant="label" label="Loading state" />
        <SocialSignInButton
          provider="google"
          loading={props.loading}
          onClick={props.onClick}
        />
      </Stack>
      <Stack spacing={3}>
        <Text variant="label" label="Disabled" />
        <SocialSignInButton
          provider="google"
          disabled
          onClick={props.onClick}
        />
      </Stack>
    </>
  );
}

function DevExamples(props: { onClick: () => void }): JSX.Element {
  return (
    <>
      <Stack spacing={3}>
        <Text variant="label" label="Dev IdP · Light · Rectangular" />
        <SocialSignInButton provider="dev" onClick={props.onClick} />
      </Stack>
      <Stack spacing={3}>
        <Text variant="label" label="Dev IdP · Dark · Pill · Sign in" />
        <SocialSignInButton
          provider="dev"
          theme="dark"
          shape="pill"
          action="signIn"
          onClick={props.onClick}
        />
      </Stack>
      <Stack spacing={3}>
        <Text variant="label" label="Dev IdP · Neutral · Rectangular" />
        <SocialSignInButton
          provider="dev"
          theme="neutral"
          onClick={props.onClick}
        />
      </Stack>
    </>
  );
}
