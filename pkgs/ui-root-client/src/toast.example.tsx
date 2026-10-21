/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { Pressable } from './pressable';
import { StackHorizontal, StackVertical } from './stack';
import { P, Text } from './text';
import { ToastCard, type ToastOptions, useToast } from './toast';
import { ToastProvider } from './toast-provider';

function ShowButton(props: {
  label: string;
  options: ToastOptions;
}): JSX.Element {
  const toast = useToast();
  return (
    <Pressable
      onPress={() => toast.show(props.options)}
      paddingX="md"
      minHeight="control"
      radius="control"
      justify="center"
    >
      <Text variant="label">{props.label}</Text>
    </Pressable>
  );
}

function Triggers(): JSX.Element {
  return (
    <StackHorizontal gap="sm" wrap>
      <ShowButton label="Neutral" options={{ message: 'Link copied' }} />
      <ShowButton
        label="Success"
        options={{ message: 'Profile saved', tone: 'success' }}
      />
      <ShowButton
        label="Destructive"
        options={{
          message: 'Could not save',
          description: 'Check your connection and try again.',
          tone: 'destructive',
        }}
      />
      <ShowButton
        label="With action"
        options={{
          message: 'Game archived',
          action: { label: 'Undo', onPress: () => undefined },
        }}
      />
    </StackHorizontal>
  );
}

const STILL: readonly ToastOptions[] = [
  { message: 'Link copied' },
  { message: 'Profile saved', tone: 'success' },
  {
    message: 'Could not save',
    description: 'Check your connection and try again.',
    tone: 'destructive',
  },
  {
    message: 'Game archived',
    action: { label: 'Undo', onPress: () => undefined },
  },
];

export default function ToastExample(): JSX.Element {
  return (
    <ToastProvider>
      <ExampleRoot>
        <ExampleSection title="Show a toast (at most three stack)">
          <Triggers />
        </ExampleSection>
        <ExampleSection title="Every tone, held still (no auto-dismiss)">
          <StackVertical gap="sm">
            <For each={STILL}>
              {(options) => (
                <ToastCard
                  options={{ ...options, duration: Number.POSITIVE_INFINITY }}
                  leaving={false}
                  onDismiss={() => undefined}
                />
              )}
            </For>
          </StackVertical>
        </ExampleSection>
        <P variant="caption">{'Hover or focus a toast to keep it.'}</P>
      </ExampleRoot>
    </ToastProvider>
  );
}
