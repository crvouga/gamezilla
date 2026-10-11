/** @jsxImportSource solid-js */
/**
 * Text, headings, landmarks, lists and the small semantic hosts: the element
 * is the meaning, the props are tokens.
 */

import { describe, expect, test } from 'bun:test';
import { CodeBlock } from '@pkgs/ui-root-client/code-block';
import { Divider } from '@pkgs/ui-root-client/divider';
import { FieldLabel } from '@pkgs/ui-root-client/field-label';
import { H1, H2, H3, H4, H5, H6 } from '@pkgs/ui-root-client/heading';
import { Icon } from '@pkgs/ui-root-client/icon';
import { ClockIcon } from '@pkgs/ui-root-client/icons';
import {
  Article,
  Aside,
  Footer,
  Header,
  Main,
  Nav,
  Section,
} from '@pkgs/ui-root-client/landmarks';
import {
  ListEntry,
  OrderedList,
  UnorderedList,
} from '@pkgs/ui-root-client/semantic-list';
import { Sparkline, sparklinePoints } from '@pkgs/ui-root-client/sparkline';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { Code, Em, P, Strong, Text, Time } from '@pkgs/ui-root-client/text';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { VisuallyHidden } from '@pkgs/ui-root-client/visually-hidden';
import { COLOR_TONES } from '@pkgs/ui-root-shared/token-names';
import { textToneColor } from '@pkgs/ui-root-shared/tones';
import { render } from '@solidjs/testing-library';
import { For } from 'solid-js';

function byTestId(testId: string): Element {
  const element = document.querySelector(`[data-testid="${testId}"]`);
  if (element === null) throw new Error(`no element ${testId}`);
  return element;
}

function classes(testId: string): readonly string[] {
  return [...byTestId(testId).classList];
}

describe('text', () => {
  test('each component is its element, in its default role', () => {
    render(() => (
      <>
        <P testId="p">{'p'}</P>
        <Text testId="text">{'text'}</Text>
        <Strong testId="strong">{'strong'}</Strong>
        <Em testId="em">{'em'}</Em>
        <Code testId="code">{'code'}</Code>
        <Time testId="time" dateTime="2026-01-05">
          {'5 Jan'}
        </Time>
      </>
    ));
    expect(byTestId('p').tagName).toBe('P');
    expect(classes('p')).toEqual(['text', 'textBody']);
    expect(byTestId('text').tagName).toBe('SPAN');
    expect(classes('text')).toEqual(['text', 'textBody', 'inline']);
    expect(byTestId('strong').tagName).toBe('STRONG');
    expect(classes('strong')).toEqual(['font-semibold']);
    expect(byTestId('em').tagName).toBe('EM');
    expect(classes('em')).toEqual(['italic']);
    expect(byTestId('code').tagName).toBe('CODE');
    expect(classes('code')).toEqual(['text', 'textMono', 'inline']);
    expect(byTestId('time').tagName).toBe('TIME');
    expect(byTestId('time').getAttribute('datetime')).toBe('2026-01-05');
    expect(byTestId('p').getAttribute('data-component')).toBe('P');
  });

  test('variant picks the role class; inherit adds none', () => {
    render(() => (
      <>
        <P testId="caption" variant="caption" />
        <P testId="footnote" variant="footnote" />
        <P testId="label" variant="label" />
        <P testId="bold" variant="bodyBold" />
        <P testId="mono" variant="mono" />
        <Text testId="inherit" variant="inherit" tone="tint" />
      </>
    ));
    expect(classes('caption')).toEqual(['text', 'textCaption']);
    expect(classes('footnote')).toEqual(['text', 'textFootnote']);
    expect(classes('label')).toEqual(['text', 'textLabel']);
    expect(classes('bold')).toEqual(['text', 'textBodyBold']);
    expect(classes('mono')).toEqual(['text', 'textMono']);
    expect(classes('inherit')).toEqual(['text-tint']);
  });

  test('style props map to one class each; a clamped run is a block', () => {
    render(() => (
      <>
        <P
          testId="styled"
          tone="secondary"
          align="center"
          lines={2}
          numeral
          wrap="nowrap"
          selectable
        />
        <Text testId="clamped" lines={1} />
        <P testId="unselectable" selectable={false} wrap="break" align="end" />
      </>
    ));
    expect(classes('styled')).toEqual([
      'text',
      'textBody',
      'text-text-secondary',
      'text-center',
      'line-clamp-2',
      'textNumeral',
      'whitespace-nowrap',
      'select-text',
    ]);
    expect(classes('clamped')).toEqual(['text', 'textBody', 'line-clamp-1']);
    expect(classes('unselectable')).toEqual([
      'text',
      'textBody',
      'text-end',
      'break-all',
      'select-none',
    ]);
  });

  test('every tone is the text utility of the palette role it aliases', () => {
    render(() => (
      <For each={COLOR_TONES}>
        {(tone) => <P testId={`tone-${tone}`} tone={tone} />}
      </For>
    ));
    const kebab = (name: string): string =>
      name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    for (const tone of COLOR_TONES) {
      const expected =
        tone === 'inherit'
          ? 'text-inherit'
          : `text-${kebab(textToneColor[tone])}`;
      expect(classes(`tone-${tone}`)).toEqual(['text', 'textBody', expected]);
    }
  });

  test('a status paragraph announces itself', () => {
    render(() => (
      <P testId="status" role="status" aria-live="polite" aria-atomic>
        {'Saved'}
      </P>
    ));
    expect(byTestId('status').getAttribute('role')).toBe('status');
    expect(byTestId('status').getAttribute('aria-live')).toBe('polite');
    expect(byTestId('status').getAttribute('aria-atomic')).toBe('true');
  });
});

describe('headings', () => {
  test('the component is the level, with a default size per level', () => {
    render(() => (
      <>
        <H1 testId="h1">{'1'}</H1>
        <H2 testId="h2">{'2'}</H2>
        <H3 testId="h3">{'3'}</H3>
        <H4 testId="h4">{'4'}</H4>
        <H5 testId="h5">{'5'}</H5>
        <H6 testId="h6">{'6'}</H6>
      </>
    ));
    expect(
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((id) => byTestId(id).tagName)
    ).toEqual(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
    expect(classes('h1')).toEqual(['text', 'textTitle']);
    expect(classes('h2')).toEqual(['text', 'textHeading']);
    expect(classes('h3')).toEqual(['text', 'textSubtitle']);
    expect(classes('h4')).toEqual(['text', 'textNavigationTitle']);
    expect(classes('h5')).toEqual(['text', 'textLabel']);
    expect(classes('h6')).toEqual(['text', 'textLabel']);
  });

  test('size is independent of the level', () => {
    render(() => (
      <H2 testId="h" size="label" tone="secondary" align="center" lines={1}>
        {'Dense'}
      </H2>
    ));
    expect(byTestId('h').tagName).toBe('H2');
    expect(classes('h')).toEqual([
      'text',
      'textLabel',
      'text-text-secondary',
      'text-center',
      'line-clamp-1',
    ]);
  });
});

describe('landmarks and lists', () => {
  test('each landmark is its element and has no box of its own', () => {
    render(() => (
      <>
        <Nav testId="nav" aria-label="Sections" />
        <Main testId="main" />
        <Section testId="section" aria-labelledby="title" />
        <Article testId="article" />
        <Aside testId="aside" />
        <Header testId="header" />
        <Footer testId="footer" />
      </>
    ));
    const tags = [
      'nav',
      'main',
      'section',
      'article',
      'aside',
      'header',
      'footer',
    ];
    for (const tag of tags) {
      expect(byTestId(tag).tagName).toBe(tag.toUpperCase());
      expect(classes(tag)).toEqual(['contents']);
    }
    expect(byTestId('nav').getAttribute('aria-label')).toBe('Sections');
    expect(byTestId('section').getAttribute('aria-labelledby')).toBe('title');
  });

  test('list entries are direct children of their list inside a stack', () => {
    render(() => (
      <StackVertical testId="stack" gap="sm">
        <UnorderedList testId="ul" aria-label="Games">
          <ListEntry testId="li">{'Chess'}</ListEntry>
        </UnorderedList>
        <OrderedList testId="ol" />
      </StackVertical>
    ));
    expect(byTestId('ul').tagName).toBe('UL');
    expect(byTestId('ol').tagName).toBe('OL');
    expect(byTestId('li').tagName).toBe('LI');
    expect(byTestId('li').parentElement?.getAttribute('data-testid')).toBe(
      'ul'
    );
    expect(byTestId('ul').parentElement?.getAttribute('data-testid')).toBe(
      'stack'
    );
    expect(classes('ul')).toEqual(['contents']);
    expect(classes('li')).toEqual(['contents']);
  });
});

describe('small hosts', () => {
  test('VisuallyHidden keeps text for assistive technology only', () => {
    render(() => (
      <VisuallyHidden testId="vh" role="status" aria-live="polite">
        {'Solved'}
      </VisuallyHidden>
    ));
    expect(classes('vh')).toEqual(['sr-only']);
    expect(byTestId('vh').textContent).toBe('Solved');
    expect(byTestId('vh').getAttribute('role')).toBe('status');
  });

  test('Divider is a separator along the stack it divides', () => {
    render(() => (
      <>
        <Divider testId="h" />
        <Divider testId="v" orientation="vertical" />
      </>
    ));
    expect(byTestId('h').getAttribute('role')).toBe('separator');
    expect(byTestId('h').getAttribute('aria-orientation')).toBe('horizontal');
    expect(classes('h')).toEqual(['box', 'self-stretch', 'h-px', 'bg-border']);
    expect(byTestId('v').getAttribute('aria-orientation')).toBe('vertical');
    expect(classes('v')).toEqual(['box', 'self-stretch', 'w-px', 'bg-border']);
  });

  test('FieldLabel points at its control and marks required and hint', () => {
    render(() => (
      <FieldLabel testId="label" for="email" required hint="optional">
        {'Email'}
      </FieldLabel>
    ));
    const label = byTestId('label');
    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBe('email');
    expect(label.textContent).toBe('Email*optional');
    expect(label.querySelector('[aria-hidden="true"]')?.textContent).toBe('*');
  });

  test('CodeBlock keeps whitespace, scrolls or wraps, and can drop its frame', () => {
    render(() => (
      <>
        <CodeBlock testId="framed">{'{\n  "a": 1\n}'}</CodeBlock>
        <CodeBlock testId="plain" wrap framed={false}>
          {'long'}
        </CodeBlock>
      </>
    ));
    expect(byTestId('framed').tagName).toBe('PRE');
    expect(byTestId('framed').textContent).toBe('{\n  "a": 1\n}');
    expect(classes('framed')).toEqual([
      'text',
      'textMono',
      'select-text',
      'whitespace-pre',
      'overflow-x-auto',
      'bg-surface-muted',
      'rounded-control',
      'p-ui-md',
    ]);
    expect(classes('plain')).toEqual([
      'text',
      'textMono',
      'select-text',
      'whitespace-pre-wrap',
      'break-words',
    ]);
  });

  test('Sparkline spans its series and draws nothing for one point', () => {
    expect(sparklinePoints([])).toBe('');
    expect(sparklinePoints([4])).toBe('');
    expect(sparklinePoints([0, 10])).toBe('0,47 280,1');
    expect(sparklinePoints([5, 5, 5])).toBe('0,47 140,47 280,47');
    render(() => (
      <>
        <Sparkline testId="line" values={[1, 3, 2]} tone="success" size="sm" />
        <Sparkline testId="named" values={[1, 2]} aria-label="Rating" />
        <Sparkline testId="empty" values={[1]} />
      </>
    ));
    expect(byTestId('line').tagName.toLowerCase()).toBe('svg');
    expect([...byTestId('line').classList]).toEqual([
      'box',
      'w-full',
      'h-ui-control-sm',
      'text-success',
    ]);
    expect(byTestId('line').getAttribute('aria-hidden')).toBe('true');
    expect(
      byTestId('line').querySelector('polyline')?.getAttribute('stroke')
    ).toBe('currentColor');
    expect(byTestId('named').getAttribute('role')).toBe('img');
    expect(byTestId('named').getAttribute('aria-label')).toBe('Rating');
    expect(document.querySelector('[data-testid="empty"]')).toBeNull();
  });

  test('Icon draws a held icon at a token size', () => {
    const view = render(() => (
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 320, height: 480 }}
      >
        <Icon icon={ClockIcon} size="sm" label="Clock" />
      </ThemeProvider>
    ));
    const icon = view.getByRole('img');
    expect(icon.getAttribute('aria-label')).toBe('Clock');
    expect(icon.querySelector('svg')?.getAttribute('width')).toBe('16');
  });
});
