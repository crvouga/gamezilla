import { useTimers } from '@pkgs/clock';
import { useCallback, useState } from 'react';
import { useTheme } from '../../theme';
import { Divider } from '../divider';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { ChevronRightIcon } from '../icons';
import { Stack } from '../stack';
import { Text } from '../text';
import {
  Button,
  type ButtonIntent,
  type ButtonVariant,
  buttonForegroundColor,
} from './button';
import { useMutationButton } from './use-mutation-button';

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
  const { setTimeout: schedule } = useTimers();
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
        endIcon={<ChevronRightIcon color={iconColor} />}
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
          schedule(() => setLoading(false), 2000);
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
  const timers = useTimers();
  const delay = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        timers.setTimeout(resolve, ms);
      }),
    [timers]
  );
  const succeed = useMutationButton({
    operation: useCallback(() => delay(900), [delay]),
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
    }, [delay]),
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
    <ExampleRoot>
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
      <VariantBlock intent="success" label="Success" />
      <VariantBlock
        intent="success"
        variant="outline"
        label="Success · outline"
      />
      <Divider />
      <VariantBlock intent="neutral" label="Neutral" />
      <VariantBlock intent="neutral" variant="ghost" label="Neutral · ghost" />
    </ExampleRoot>
  );
}
