/** @jsxImportSource solid-js */
import { createSignal, For, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import type { FloatingMenuPlacement } from './floating-menu-position';
import type { PopoverSize, PopoverTriggerProps } from './popover';
import { Popover } from './popover';
import { Pressable } from './pressable';
import { Radio, RadioGroup } from './radio-group';
import { StackHorizontal } from './stack';
import { P, Text } from './text';

const PLACEMENTS: readonly FloatingMenuPlacement[] = [
  'bottom-start',
  'bottom-end',
  'top-start',
  'top-end',
];
const SIZES: readonly PopoverSize[] = ['sm', 'md', 'lg'];

function Trigger(props: {
  trigger: PopoverTriggerProps;
  label: string;
}): JSX.Element {
  return (
    <Pressable
      {...props.trigger}
      paddingX="md"
      minHeight="control"
      radius="control"
      justify="center"
    >
      <Text variant="label">{props.label}</Text>
    </Pressable>
  );
}

function FilterBody(): JSX.Element {
  const [sort, setSort] = createSignal<string | undefined>('recent');
  return (
    <>
      <P variant="bodyBold">{'Sort games'}</P>
      <RadioGroup
        aria-label="Sort games"
        value={sort()}
        onValueChange={setSort}
      >
        <Radio value="recent" label="Most recent" />
        <Radio value="longest" label="Longest" />
      </RadioGroup>
    </>
  );
}

function Controlled(): JSX.Element {
  const [open, setOpen] = createSignal(false);
  return (
    <StackHorizontal gap="md" align="center">
      <Popover
        label="Controlled"
        open={open()}
        onOpenChange={setOpen}
        trigger={(trigger) => <Trigger trigger={trigger} label="Controlled" />}
      >
        <P>{'The caller owns the open state.'}</P>
      </Popover>
      <P variant="caption">{open() ? 'Open' : 'Closed'}</P>
    </StackHorizontal>
  );
}

export default function PopoverExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="With interactive content">
        <Popover
          label="Filters"
          trigger={(trigger) => <Trigger trigger={trigger} label="Filters" />}
        >
          <FilterBody />
        </Popover>
      </ExampleSection>
      <ExampleSection title="Placements">
        <StackHorizontal gap="sm" wrap>
          <For each={PLACEMENTS}>
            {(placement) => (
              <Popover
                label={placement}
                placement={placement}
                size="sm"
                trigger={(trigger) => (
                  <Trigger trigger={trigger} label={placement} />
                )}
              >
                <P>{`Placed ${placement}.`}</P>
              </Popover>
            )}
          </For>
        </StackHorizontal>
      </ExampleSection>
      <ExampleSection title="Sizes">
        <StackHorizontal gap="sm" wrap>
          <For each={SIZES}>
            {(size) => (
              <Popover
                label={`Size ${size}`}
                size={size}
                trigger={(trigger) => (
                  <Trigger trigger={trigger} label={`Size ${size}`} />
                )}
              >
                <P>
                  {'A short explanation that wraps inside the panel width.'}
                </P>
              </Popover>
            )}
          </For>
        </StackHorizontal>
      </ExampleSection>
      <ExampleSection title="Controlled">
        <Controlled />
      </ExampleSection>
    </ExampleRoot>
  );
}
