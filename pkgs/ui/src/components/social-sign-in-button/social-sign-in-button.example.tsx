import { useTimers } from '@pkgs/clock';
import { useState } from 'react';
import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { Text } from '../text';
import { SocialSignInButton } from './social-sign-in-button';

function SocialSignInDemo() {
  const timers = useTimers();
  const [loading, setLoading] = useState(false);

  function handlePress() {
    setLoading(true);
    timers.setTimeout(() => setLoading(false), 1500);
  }

  return (
    <>
      <GoogleExamples onPress={handlePress} loading={loading} />
      <DevExamples onPress={handlePress} />
    </>
  );
}

export default function SocialSignInButtonExample() {
  return (
    <ExampleRoot>
      <SocialSignInDemo />
    </ExampleRoot>
  );
}

function GoogleExamples({
  onPress,
  loading,
}: {
  onPress: () => void;
  loading: boolean;
}) {
  return (
    <>
      <Stack spacing={3}>
        <Text variant="label" label="Google · Light · Rectangular (default)" />
        <SocialSignInButton provider="google" onPress={onPress} />
      </Stack>
      <Stack spacing={3}>
        <Text variant="label" label="Google · Light · Pill" />
        <SocialSignInButton provider="google" shape="pill" onPress={onPress} />
      </Stack>
      <Stack spacing={3}>
        <Text variant="label" label="Google · Dark · Pill · Sign in" />
        <SocialSignInButton
          provider="google"
          theme="dark"
          shape="pill"
          action="signIn"
          onPress={onPress}
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
          onPress={onPress}
        />
      </Stack>
      <Stack spacing={3}>
        <Text variant="label" label="Loading state" />
        <SocialSignInButton
          provider="google"
          loading={loading}
          onPress={onPress}
        />
      </Stack>
      <Stack spacing={3}>
        <Text variant="label" label="Disabled" />
        <SocialSignInButton provider="google" disabled onPress={onPress} />
      </Stack>
    </>
  );
}

function DevExamples({ onPress }: { onPress: () => void }) {
  return (
    <>
      <Stack spacing={3}>
        <Text variant="label" label="Dev IdP · Light · Rectangular" />
        <SocialSignInButton provider="dev" onPress={onPress} />
      </Stack>
      <Stack spacing={3}>
        <Text variant="label" label="Dev IdP · Dark · Pill · Sign in" />
        <SocialSignInButton
          provider="dev"
          theme="dark"
          shape="pill"
          action="signIn"
          onPress={onPress}
        />
      </Stack>
      <Stack spacing={3}>
        <Text variant="label" label="Dev IdP · Neutral · Rectangular" />
        <SocialSignInButton provider="dev" theme="neutral" onPress={onPress} />
      </Stack>
    </>
  );
}
