import { useCallback, useState } from 'react';
import { Box } from '../box';
import { Divider } from '../divider';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { ChevronRightIcon } from '../icons';
import { Text } from '../text';
import {
  Button,
  buttonForegroundColor,
  type ButtonIntent,
  type ButtonVariant,
} from './button';
import { useMutationButton } from './use-mutation-button';
import { useTheme } from '../../theme';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
          <ChevronRightIcon size={16} color={iconColor} />
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

function FeedbackBlock() {
  const succeed = useMutationButton({
    operation: useCallback(() => delay(900), []),
    labels: {
      idle: 'Save',
      loading: 'Saving…',
      success: 'Saved',
      error: "Couldn't save",
    },
  });
  const fail = useMutationButton({
    operation: useCallback(async () => {
      await delay(900);
      throw new Error('Network unreachable');
    }, []),
    labels: {
      idle: 'Join space',
      loading: 'Joining…',
      success: 'Joined',
      error: "Couldn't join",
    },
  });
  return (
    <>
      <SectionLabel label="Feedback (loading → success / error)" />
      <SchemePreview>
        <Stack spacing={2}>
          <Button {...succeed.buttonProps} />
          <Button intent="primary" {...fail.buttonProps} />
        </Stack>
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
      <FeedbackBlock />
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
      <VariantBlock
        intent="danger"
        variant="outline"
        label="Danger · outline"
      />
      <Divider />
      <VariantBlock intent="neutral" label="Neutral" />
      <VariantBlock intent="neutral" variant="ghost" label="Neutral · ghost" />
    </Box>
  );
}
