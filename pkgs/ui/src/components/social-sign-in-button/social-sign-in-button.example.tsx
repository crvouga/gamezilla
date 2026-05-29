import { useState } from 'react';

import { Box } from '../box';
import { Stack } from '../stack';
import { Text } from '../text';
import { SocialSignInButton } from './social-sign-in-button';

export default function SocialSignInButtonExample() {
  const [loading, setLoading] = useState(false);

  function handlePress() {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  }

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="SocialSignInButton" />
      <GoogleExamples onPress={handlePress} loading={loading} />
      <DevExamples onPress={handlePress} />
    </Box>
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
