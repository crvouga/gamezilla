import { useState } from 'react';
import { Box } from '../box';
import { Divider } from '../divider';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { IconSymbol } from '../symbol-icon';
import { Text } from '../text';
import { Button, buttonForegroundColor, type ButtonIntent } from './button';
import { useTheme } from '../../theme';

function ButtonRow({
  intent,
  loading,
  setLoading,
}: {
  intent: ButtonIntent;
  loading: boolean;
  setLoading: (b: boolean) => void;
}) {
  const theme = useTheme();
  const iconColor = buttonForegroundColor(theme, intent, false);
  return (
    <Stack spacing={2}>
      <Button title="Default" intent={intent} onPress={() => {}} />
      <Button
        title="With icon"
        intent={intent}
        endIcon={
          <IconSymbol name="chevron.right" size={16} color={iconColor} />
        }
        onPress={() => {}}
      />
      <Button title="Disabled" intent={intent} disabled onPress={() => {}} />
      <Button
        title={loading ? 'Loading…' : 'Tap to load'}
        intent={intent}
        loading={loading}
        onPress={() => {
          setLoading(true);
          setTimeout(() => setLoading(false), 2000);
        }}
      />
    </Stack>
  );
}

export default function ButtonExample() {
  const [primaryLoading, setPrimaryLoading] = useState(false);

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="Button" />

      <Text variant="label" sx={{ color: 'textSecondary' }} label="Sizes" />
      <SchemePreview>
        <Stack spacing={2}>
          <Button title="Small" size="sm" onPress={() => {}} />
          <Button title="Medium" size="md" onPress={() => {}} />
          <Button title="Large" size="lg" onPress={() => {}} />
        </Stack>
      </SchemePreview>

      <Divider />

      <Text variant="label" sx={{ color: 'textSecondary' }} label="Primary" />
      <SchemePreview>
        <ButtonRow
          intent="primary"
          loading={primaryLoading}
          setLoading={setPrimaryLoading}
        />
      </SchemePreview>

      <Divider />

      <Text variant="label" sx={{ color: 'textSecondary' }} label="Danger" />
      <SchemePreview>
        <ButtonRow
          intent="danger"
          loading={false}
          setLoading={() => {}}
        />
      </SchemePreview>

      <Divider />

      <Text variant="label" sx={{ color: 'textSecondary' }} label="Neutral" />
      <SchemePreview>
        <ButtonRow
          intent="neutral"
          loading={false}
          setLoading={() => {}}
        />
      </SchemePreview>
    </Box>
  );
}
