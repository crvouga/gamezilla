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

      <Stack spacing={3}>
        <Text variant="label" label="Google · Light · Rectangular (default)" />
        <SocialSignInButton provider="google" onPress={handlePress} />
      </Stack>

      <Stack spacing={3}>
        <Text variant="label" label="Google · Light · Pill" />
        <SocialSignInButton
          provider="google"
          shape="pill"
          onPress={handlePress}
        />
      </Stack>

      <Stack spacing={3}>
        <Text variant="label" label="Google · Dark · Pill · Sign in" />
        <SocialSignInButton
          provider="google"
          theme="dark"
          shape="pill"
          action="signIn"
          onPress={handlePress}
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
          onPress={handlePress}
        />
      </Stack>

      <Stack spacing={3}>
        <Text variant="label" label="Loading state" />
        <SocialSignInButton
          provider="google"
          loading={loading}
          onPress={handlePress}
        />
      </Stack>

      <Stack spacing={3}>
        <Text variant="label" label="Disabled" />
        <SocialSignInButton provider="google" disabled onPress={handlePress} />
      </Stack>
    </Box>
  );
}
