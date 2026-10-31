/** @jsxImportSource solid-js */
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { Button } from '@pkgs/ui-root-client-ts/button';
import type {
  ButtonIntent,
  ButtonVariant,
} from '@pkgs/ui-root-client-ts/button-face';
import {
  ChevronRightIcon,
  PlusIcon,
  Trash2Icon,
} from '@pkgs/ui-root-client-ts/icons';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { createSignal, For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

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
    <div class="box flex-row flex-wrap items-center gap-2">
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
  return <label class="text textFootnote">{props.label}</label>;
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
      <SectionLabel label="Feedback (loading → success / error, tap to retry)" />
      <SchemePreview>
        <div class="box flex-col gap-2">
          <Button {...succeed.buttonProps} />
          <Button intent="primary" {...fail.buttonProps} />
          <div class="box flex-row flex-wrap items-center gap-2">
            <Button title="Saved" feedback="success" successLabel="Saved" />
            <Button
              title="Save"
              feedback="error"
              errorLabel="Couldn't save"
              onRetry={() => undefined}
            />
            <Button
              title="Delete"
              intent="danger"
              icon={Trash2Icon}
              loading
              loadingLabel="Deleting…"
            />
          </div>
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
          <div class="box flex-row flex-wrap items-center gap-2">
            <Button title="Small · 32 (44 hit area)" size="sm" />
            <Button title="Medium · 44" size="md" />
            <Button title="Large · 52" size="lg" />
          </div>
          <div class="box flex-row flex-wrap items-center gap-2">
            <Button title="Add" size="sm" icon={PlusIcon} intent="neutral" />
            <Button title="Add" size="md" icon={PlusIcon} intent="neutral" />
            <Button title="Add" size="lg" icon={PlusIcon} intent="neutral" />
          </div>
          <Button title="Full width" size="lg" fullWidth />
        </div>
      </SchemePreview>
    </>
  );
}

/** The design brief's four buttons, as `intent` × `variant`. */
const BRIEF_VARIANTS: readonly {
  label: string;
  intent: ButtonIntent;
  variant: ButtonVariant;
}[] = [
  { label: 'Primary', intent: 'primary', variant: 'solid' },
  { label: 'Secondary (neutral)', intent: 'neutral', variant: 'solid' },
  { label: 'Ghost', intent: 'neutral', variant: 'ghost' },
  { label: 'Danger (outline)', intent: 'danger', variant: 'outline' },
  { label: 'Danger, confirming (solid)', intent: 'danger', variant: 'solid' },
];

/** Every other combination the API allows. */
const OTHER_VARIANTS: readonly {
  label: string;
  intent: ButtonIntent;
  variant: ButtonVariant;
}[] = [
  {
    label: 'Neutral · outline (same as secondary)',
    intent: 'neutral',
    variant: 'outline',
  },
  { label: 'Primary · outline', intent: 'primary', variant: 'outline' },
  { label: 'Primary · ghost (text link)', intent: 'primary', variant: 'ghost' },
  { label: 'Danger · ghost', intent: 'danger', variant: 'ghost' },
];

export default function ButtonExample(): JSX.Element {
  return (
    <ExampleRoot>
      <p class="text textCaption">
        {
          'Hover for the tint, press for the 0.97 settle, Tab for the 2px focus ring. Each row: default, with icon, disabled, loading.'
        }
      </p>
      <For each={BRIEF_VARIANTS}>
        {(entry) => (
          <VariantBlock
            intent={entry.intent}
            variant={entry.variant}
            label={entry.label}
          />
        )}
      </For>
      <div class="divider" role="separator" />
      <FeedbackBlock />
      <div class="divider" role="separator" />
      <SizesBlock />
      <div class="divider" role="separator" />
      <For each={OTHER_VARIANTS}>
        {(entry) => (
          <VariantBlock
            intent={entry.intent}
            variant={entry.variant}
            label={entry.label}
          />
        )}
      </For>
    </ExampleRoot>
  );
}
