import { useState } from 'react';
import { Box } from '../box';
import { Divider } from '../divider';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { IconSymbol } from '../symbol-icon';
import { Text } from '../text';
import {
  Button,
  buttonForegroundColor,
  type ButtonIntent,
  type ButtonVariant,
} from './button';
import { useTheme } from '../../theme';

function ButtonRow({
  intent,
  variant = 'solid',
  loading,
  setLoading,
}: {
  intent: ButtonIntent;
  variant?: ButtonVariant | undefined;
  loading: boolean;
  setLoading: (b: boolean) => void;
}) {
  const theme = useTheme();
  const iconColor = buttonForegroundColor(theme, intent, false, variant);
  return (
    <Stack spacing={2}>
      <Button
        title="Default"
        intent={intent}
        variant={variant}
        onPress={() => {}}
      />
      <Button
        title="With icon"
        intent={intent}
        variant={variant}
        endIcon={
          <IconSymbol name="chevron.right" size={16} color={iconColor} />
        }
        onPress={() => {}}
      />
      <Button
        title="Disabled"
        intent={intent}
        variant={variant}
        disabled
        onPress={() => {}}
      />
      <Button
        title={loading ? 'Loading…' : 'Tap to load'}
        intent={intent}
        variant={variant}
        loading={loading}
        onPress={() => {
          setLoading(true);
          setTimeout(() => setLoading(false), 2000);
        }}
      />
    </Stack>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text variant="label" sx={{ color: 'textSecondary' }} label={label} />;
}

function VariantBlock({
  intent,
  variant,
  label,
  loading = false,
  setLoading = () => {},
}: {
  intent: ButtonIntent;
  variant?: ButtonVariant | undefined;
  label: string;
  loading?: boolean;
  setLoading?: (b: boolean) => void;
}) {
  return (
    <>
      <SectionLabel label={label} />
      <SchemePreview>
        <ButtonRow
          intent={intent}
          variant={variant}
          loading={loading}
          setLoading={setLoading}
        />
      </SchemePreview>
    </>
  );
}

function SizesBlock() {
  return (
    <>
      <SectionLabel label="Sizes" />
      <SchemePreview>
        <Stack spacing={2}>
          <Button title="Small" size="sm" onPress={() => {}} />
          <Button title="Medium" size="md" onPress={() => {}} />
          <Button title="Large" size="lg" onPress={() => {}} />
        </Stack>
      </SchemePreview>
    </>
  );
}

export default function ButtonExample() {
  const [primaryLoading, setPrimaryLoading] = useState(false);

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="Button" />
      <SizesBlock />
      <Divider />
      <VariantBlock
        intent="primary"
        label="Primary"
        loading={primaryLoading}
        setLoading={setPrimaryLoading}
      />
      <VariantBlock
        intent="primary"
        variant="outline"
        label="Primary · outline"
      />
      <VariantBlock intent="primary" variant="ghost" label="Primary · ghost" />
      <Divider />
      <VariantBlock intent="danger" label="Danger" />
      <VariantBlock intent="danger" variant="outline" label="Danger · outline" />
      <Divider />
      <VariantBlock intent="neutral" label="Neutral" />
      <VariantBlock intent="neutral" variant="ghost" label="Neutral · ghost" />
    </Box>
  );
}
