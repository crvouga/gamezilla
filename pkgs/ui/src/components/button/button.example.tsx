/** @jsxImportSource solid-js */
import { useTimers } from '@pkgs/clock/solid';
import { createSignal, type JSX } from 'solid-js';
import { useThemeTokens } from '../../theme';
import { Divider } from '../divider';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { ChevronRightIcon } from '../icons';
import { Stack } from '../stack';
import { Text } from '../text';
import { Button } from './button';
import {
  type ButtonIntent,
  type ButtonVariant,
  buttonForegroundColor,
} from './button-face';
import { useMutationButton } from './use-mutation-button';

const LOAD_DEMO_MS = 2000;
const FEEDBACK_DEMO_MS = 900;

function ButtonRow(props: {
  intent: ButtonIntent;
  variant?: ButtonVariant | undefined;
}): JSX.Element {
  const theme = useThemeTokens();
  const timers = useTimers();
  const [loading, setLoading] = createSignal(false);
  const variant = () => props.variant ?? 'solid';
  const iconColor = () =>
    buttonForegroundColor(theme.colors, props.intent, false, variant());
  return (
    <Stack spacing={2}>
      <Button title="Default" intent={props.intent} variant={variant()} />
      <Button
        title="With icon"
        intent={props.intent}
        variant={variant()}
        endIcon={<ChevronRightIcon color={iconColor()} />}
      />
      <Button
        title="Disabled"
        intent={props.intent}
        variant={variant()}
        disabled
      />
      <Button
        title={loading() ? 'Loading…' : 'Tap to load'}
        intent={props.intent}
        variant={variant()}
        loading={loading()}
        onClick={() => {
          setLoading(true);
          timers.setTimeout(() => setLoading(false), LOAD_DEMO_MS);
        }}
      />
    </Stack>
  );
}

function SectionLabel(props: { label: string }): JSX.Element {
  return (
    <Text variant="label" sx={{ color: 'textSecondary' }} label={props.label} />
  );
}

function VariantBlock(props: {
  intent: ButtonIntent;
  variant?: ButtonVariant | undefined;
  label: string;
}): JSX.Element {
  return (
    <>
      <SectionLabel label={props.label} />
      <SchemePreview>
        <ButtonRow intent={props.intent} variant={props.variant} />
      </SchemePreview>
    </>
  );
}

function FeedbackBlock(): JSX.Element {
  const timers = useTimers();
  const delay = (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
      timers.setTimeout(resolve, ms);
    });
  const succeed = useMutationButton({
    operation: () => delay(FEEDBACK_DEMO_MS),
    labels: {
      idle: 'Save',
      loading: 'Saving…',
      success: 'Saved',
      error: "Couldn't save",
    },
  });
  const fail = useMutationButton({
    operation: async () => {
      await delay(FEEDBACK_DEMO_MS);
      throw new Error('Network unreachable');
    },
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

function SizesBlock(): JSX.Element {
  return (
    <>
      <SectionLabel label="Sizes" />
      <SchemePreview>
        <Stack spacing={2}>
          <Button title="Small" size="sm" />
          <Button title="Medium" size="md" />
          <Button title="Large" size="lg" />
        </Stack>
      </SchemePreview>
    </>
  );
}

export default function ButtonExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SizesBlock />
      <Divider />
      <FeedbackBlock />
      <Divider />
      <VariantBlock intent="primary" label="Primary" />
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
