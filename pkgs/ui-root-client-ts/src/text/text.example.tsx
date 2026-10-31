/** @jsxImportSource solid-js */

import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import type { TextRole } from '@pkgs/ui-root-client-ts/text';
import { Code, Em, P, Strong, Text, Time } from '@pkgs/ui-root-client-ts/text';
import type {
  TextAlign,
  TextLines,
  TextWrap,
} from '@pkgs/ui-root-client-ts/text-classes';
import { COLOR_TONES } from '@pkgs/ui-root-shared-ts/token-names';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const ROLES: readonly TextRole[] = [
  'body',
  'bodyBold',
  'label',
  'caption',
  'footnote',
  'mono',
];
const ALIGNS: readonly TextAlign[] = ['start', 'center', 'end'];
const LINES: readonly TextLines[] = [1, 2, 3, 4, 6];
const WRAPS: readonly TextWrap[] = ['normal', 'nowrap', 'break'];

const LONG =
  'The quick brown fox jumps over the lazy dog, then turns around and does it again, and again, until the paragraph is long enough to need several lines on any phone, tablet or desktop it is ever likely to be read on by anyone at all.';
const UNBROKEN =
  'f3b1c9d27a6e4085b1d6c3a9e7f2048c5d1b6a3e9f7c2d8041b5e6a3c9d7f2e8041b5c6d3a9e7f2048c5d1b6a3e9';

function Roles(): JSX.Element {
  return (
    <ExampleSection title="variant">
      <For each={ROLES}>
        {(role) => <P variant={role}>{`${role}: the role picks the type`}</P>}
      </For>
    </ExampleSection>
  );
}

function Tones(): JSX.Element {
  return (
    <ExampleSection title="tone">
      <For each={COLOR_TONES}>
        {(tone) => (
          <Surface
            tone={tone === 'on-primary' ? 'info' : 'transparent'}
            radius="sm"
          >
            <P variant="label" tone={tone}>
              {tone}
            </P>
          </Surface>
        )}
      </For>
    </ExampleSection>
  );
}

function Shape(): JSX.Element {
  return (
    <>
      <For each={ALIGNS}>
        {(align) => (
          <ExampleSection title={`align ${align}`}>
            <P align={align}>{'Aligned text'}</P>
          </ExampleSection>
        )}
      </For>
      <For each={LINES}>
        {(lines) => (
          <ExampleSection title={`lines ${lines}`}>
            <StackVertical width="full" maxWidth="form">
              <P variant="caption" lines={lines}>
                {LONG}
              </P>
            </StackVertical>
          </ExampleSection>
        )}
      </For>
      <For each={WRAPS}>
        {(wrap) => (
          <ExampleSection title={`wrap ${wrap}`}>
            <StackVertical width="full" maxWidth="form" overflow="hidden">
              <P variant="mono" wrap={wrap}>
                {UNBROKEN}
              </P>
            </StackVertical>
          </ExampleSection>
        )}
      </For>
      <ExampleSection title="numeral">
        <P variant="label" numeral>
          {'1482 · 05:00 · $4.99'}
        </P>
      </ExampleSection>
      <ExampleSection title="selectable true / false">
        <P selectable>{'This text can be selected.'}</P>
        <P selectable={false}>{'This text cannot be selected.'}</P>
      </ExampleSection>
    </>
  );
}

function Inline(): JSX.Element {
  return (
    <ExampleSection title="Text, Strong, Em, Code, Time inside a P">
      <P>
        {'Plain, '}
        <Strong>{'strong'}</Strong>
        {', '}
        <Em>{'emphasised'}</Em>
        {', a '}
        <Code>{'code.identifier'}</Code>
        {', a '}
        <Text variant="inherit" tone="tint">
          {'tinted run'}
        </Text>
        {' and a time: '}
        <Time dateTime="2026-01-05T09:30">{'5 Jan, 09:30'}</Time>
        {'.'}
      </P>
      <P variant="caption">
        {'A caption keeps its type through '}
        <Strong>{'strong'}</Strong>
        {' and '}
        <Text variant="inherit" tone="destructive">
          {'inherit'}
        </Text>
        {' runs.'}
      </P>
      <Text variant="label">{'A standalone Text is an inline label.'}</Text>
    </ExampleSection>
  );
}

export default function TextExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <Roles />
        <Tones />
      </SchemePreview>
      <Shape />
      <Inline />
    </ExampleRoot>
  );
}
