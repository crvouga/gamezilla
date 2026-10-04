/** @jsxImportSource solid-js */
import { useTimers } from '@pkgs/clock-client/solid';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { SchemePreview } from './scheme-preview';
import { ChevronRightIcon } from './icons';
import { Button } from './button';
import type { ButtonIntent, ButtonVariant } from './button-face';
import { useMutationButton } from './use-mutation-button';

const LOAD_DEMO_MS = 2000;
const FEEDBACK_DEMO_MS = 900;

function ButtonRow(props: {
  intent: ButtonIntent;
  variant?: ButtonVariant | undefined;
}): JSX.Element {
  const timers = useTimers();
  const [loading, setLoading] = createSignal(false);
  const variant = () => props.variant ?? 'solid';
  return (
    <div class="box flex-col gap-2">
      <Button title="Default" intent={props.intent} variant={variant()} />
      <Button
        title="With icon"
        intent={props.intent}
        variant={variant()}
        endIcon={<ChevronRightIcon />}
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
    </div>
  );
}

function SectionLabel(props: { label: string }): JSX.Element {
  return (
    <label class="text textLabel text-text-secondary">{props.label}</label>
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
        <div class="box flex-col gap-2">
          <Button {...succeed.buttonProps} />
          <Button intent="primary" {...fail.buttonProps} />
        </div>
      </SchemePreview>
    </>
  );
}

function SizesBlock(): JSX.Element {
  return (
    <>
      <SectionLabel label="Sizes" />
      <SchemePreview>
        <div class="box flex-col gap-2">
          <Button title="Small" size="sm" />
          <Button title="Medium" size="md" />
          <Button title="Large" size="lg" />
        </div>
      </SchemePreview>
    </>
  );
}

export default function ButtonExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SizesBlock />
      <div class="divider" role="separator" />
      <FeedbackBlock />
      <div class="divider" role="separator" />
      <VariantBlock intent="primary" label="Primary" />
      <VariantBlock
        intent="primary"
        variant="outline"
        label="Primary · outline"
      />
      <VariantBlock intent="primary" variant="ghost" label="Primary · ghost" />
      <div class="divider" role="separator" />
      <VariantBlock intent="danger" label="Danger" />
      <VariantBlock
        intent="danger"
        variant="outline"
        label="Danger · outline"
      />
      <div class="divider" role="separator" />
      <VariantBlock intent="success" label="Success" />
      <VariantBlock
        intent="success"
        variant="outline"
        label="Success · outline"
      />
      <div class="divider" role="separator" />
      <VariantBlock intent="neutral" label="Neutral" />
      <VariantBlock intent="neutral" variant="ghost" label="Neutral · ghost" />
    </ExampleRoot>
  );
}
