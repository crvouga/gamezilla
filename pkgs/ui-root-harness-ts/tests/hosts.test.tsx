/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { Checkbox } from '@pkgs/ui-root-client-ts/checkbox';
import { CodeBlock } from '@pkgs/ui-root-client-ts/code-block';
import { ContentEdgePaddingProvider } from '@pkgs/ui-root-client-ts/content-edge-padding';
import { MetricStrip } from '@pkgs/ui-root-client-ts/metric-strip';
import { ProgressBar } from '@pkgs/ui-root-client-ts/progress-bar';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { Switch } from '@pkgs/ui-root-client-ts/switch';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { VirtualList } from '@pkgs/ui-root-client-ts/virtual-list';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

describe('Clickable', () => {
  test('renders a real button with tint feedback and forwards clicks', () => {
    const onClick = mock();
    renderUi(() => (
      <button
        class="clickable clickableTint p-2"
        type="button"
        data-testid="c"
        onClick={onClick}
      >
        <p class="text">{'Go'}</p>
      </button>
    ));
    const el = screen.getByTestId('c');
    expect(el.tagName).toBe('BUTTON');
    expect(el).toHaveAttribute('type', 'button');
    expect(el.className).toMatch(/clickableTint/);
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('disabled buttons and feedback modes', () => {
    renderUi(() => (
      <button
        class="clickable clickableOpacity"
        type="button"
        data-testid="c"
        disabled
      />
    ));
    const el = screen.getByTestId('c');
    expect(el).toBeDisabled();
    expect(el.className).toMatch(/clickableOpacity/);
    expect(el.className).not.toMatch(/clickableTint/);
  });
});

describe('Switch', () => {
  test('exposes role=switch with aria-checked and toggles', () => {
    const [on, setOn] = createSignal(false);
    renderUi(() => (
      <Switch value={on()} onValueChange={setOn} aria-label="Sound" />
    ));
    const el = screen.getByRole('switch', { name: 'Sound' });
    expect(el).toHaveAttribute('aria-checked', 'false');
    const track = el.querySelector('[class*="rounded"]');
    expect(track?.className).toMatch(/bg-transparent/);
    expect(track).toHaveAttribute('data-on', 'false');
    fireEvent.click(el);
    expect(el).toHaveAttribute('aria-checked', 'true');
    expect(el.className).toMatch(/min-h-11/);
    // On is the soft blue (`tint-subtle`), never the saturated button fill.
    expect(track?.className).toMatch(/bg-tint-subtle/);
    expect(track?.className).not.toMatch(/bg-tint-active/);
    expect(track).toHaveAttribute('data-on', 'true');
  });

  test('the thumb always contrasts with its track', () => {
    // regression: ui-switch-thumb-on-own-color
    const [on, setOn] = createSignal(false);
    renderUi(() => (
      <Switch value={on()} onValueChange={setOn} aria-label="Sound" />
    ));
    const el = screen.getByRole('switch', { name: 'Sound' });
    const track = el.querySelector('[class*="rounded"]');
    const thumb = track?.firstElementChild;
    expect(thumb?.className).toMatch(/bg-text-secondary/);
    fireEvent.click(el);
    // On is the soft blue track with a `primary-strong` thumb, never the
    // text tint and never a thumb in the track's own color.
    expect(track?.className).toMatch(/\bbg-tint-subtle\b/);
    expect(track?.className).not.toMatch(/\bbg-tint\b(?!-)/);
    expect(thumb?.className).toMatch(/\bbg-primary-strong\b/);
  });

  // regression: ui-switch-testid-on-wrapper — the test id sat on a wrapper
  // around the toggle, so tapping the switch by its id changed nothing.
  test('its test id names the toggle a person presses', () => {
    const [on, setOn] = createSignal(true);
    renderUi(() => (
      <Switch
        value={on()}
        onValueChange={setOn}
        aria-label="Sound"
        dataSet={{ testid: 'sound-switch' }}
      />
    ));
    fireEvent.click(screen.getByTestId('sound-switch'));
    expect(screen.getByRole('switch', { name: 'Sound' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });
});

describe('Checkbox', () => {
  test('tri-state aria + toggling semantics', () => {
    const onToggle = mock();
    renderUi(() => (
      <Checkbox
        checked={false}
        indeterminate
        onToggle={onToggle}
        label="Select all"
      />
    ));
    const el = screen.getByRole('checkbox', { name: /Select all/ });
    expect(el).toHaveAttribute('aria-checked', 'mixed');
    fireEvent.click(el);
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});

describe('TextInput', () => {
  // regression: ui-field-visible-label-unlinked
  test('the move review field is named by its visible label', () => {
    renderUi(() => (
      <TextInput
        type="number"
        label="Move number to review"
        value="0"
        onChangeText={() => {}}
      />
    ));
    expect(
      screen.getByRole('spinbutton', { name: 'Move number to review' })
    ).toHaveValue(0);
  });
  test('controlled value, label, error and submit', () => {
    const [value, setValue] = createSignal('');
    const onSubmit = mock();
    renderUi(() => (
      <TextInput
        value={value()}
        onChangeText={setValue}
        onSubmitEditing={onSubmit}
        label="Name"
        error={value() === 'x' ? ('Bad' as never) : undefined}
      />
    ));
    const input = screen.getByRole('textbox');
    fireEvent.input(input, { target: { value: 'x' } });
    expect(input).toHaveValue('x');
    expect(screen.getByRole('alert')).toHaveTextContent('Bad');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('masks secure entry', () => {
    renderUi(() => (
      <TextInput
        value=""
        onChangeText={() => {}}
        secureTextEntry
        aria-label={'pw' as never}
      />
    ));
    expect(screen.getByLabelText('pw')).toHaveAttribute('type', 'password');
  });
});

describe('ScrollView', () => {
  test('takes frame and content props separately and bleeds under shell padding', () => {
    renderUi(() => (
      <ContentEdgePaddingProvider step={4}>
        <ScrollView dataSet={{ testid: 'sv' }} grow gap="sm" maxHeight="lg">
          <p class="text">{'row'}</p>
        </ScrollView>
      </ContentEdgePaddingProvider>
    ));
    const frame = screen.getByTestId('sv');
    expect(frame.className).toMatch(/scroll/);
    expect(frame.className).toMatch(/flex-1/);
    expect(frame.className).toMatch(/max-h-120/);
    const content = frame.firstElementChild as HTMLElement;
    expect(content.className).toMatch(/gap-ui-sm/);
    const wrapper = frame.parentElement;
    if (wrapper === null) throw new Error('wrapper missing');
    expect(wrapper.className).toMatch(/flex-1/);
    expect(wrapper.className).toMatch(/min-h-0/);
  });
});

describe('VirtualList', () => {
  test('windows rows and renders header/footer/empty', () => {
    const items = Array.from({ length: 200 }, (_, i) => ({ id: `r${i}` }));
    renderUi(() => (
      <VirtualList
        dataSet={{ testid: 'vl' }}
        items={items}
        keyExtractor={(it) => it.id}
        renderItem={(it) => <p class="text">{it.id}</p>}
        estimateSize={40}
        fixedViewport={{ width: 300, height: 200 }}
        header={<p class="text">{'head'}</p>}
      />
    ));
    const rows = screen.getAllByRole('listitem');
    expect(rows.length).toBeGreaterThan(4);
    expect(rows.length).toBeLessThan(40);
    expect(screen.getByText('head')).toBeInTheDocument();
    expect(screen.getByText('r0')).toBeInTheDocument();
  });

  test('empty state', () => {
    renderUi(() => (
      <VirtualList
        items={[] as { id: string }[]}
        keyExtractor={(it) => it.id}
        renderItem={(it) => <p class="text">{it.id}</p>}
        empty={<p class="text">{'nothing'}</p>}
        fixedViewport={{ width: 300, height: 200 }}
      />
    ));
    expect(screen.getByText('nothing')).toBeInTheDocument();
  });
});

// regression: ui-scroll-regions-keyboard-inaccessible
test('scrollable code and view regions accept keyboard focus', () => {
  const code = renderUi(() => (
    <CodeBlock>
      {
        'Error: could not reach the room server after 3 attempts (last status 503, request 7f3a9c21-4be0-4d1f-9a55-0c2f6d1e8b77)'
      }
    </CodeBlock>
  ));
  expect(code.container.querySelector('pre')?.tabIndex).toBe(0);
  code.unmount();
  const view = renderUi(() => (
    <ScrollView horizontal>
      <P>Long horizontal content</P>
    </ScrollView>
  ));
  expect(
    view.container
      .querySelector('[data-component="ScrollView"]')
      ?.getAttribute('tabindex')
  ).toBe('0');
  view.unmount();
});

// regression: ui-progress-track-unnamed
test('bare progress tracks retain an accessible name', () => {
  const view = renderUi(() => <ProgressBar progress={0.3} size="sm" />);
  expect(view.getByRole('progressbar').getAttribute('aria-label')).toBe(
    'Progress'
  );
  view.unmount();
});

// regression: ui-metric-description-list-structure
test('metric details remain inside the description list grammar', () => {
  const view = renderUi(() => (
    <MetricStrip
      aria-label="Summary"
      metrics={[{ label: 'Solved', value: 12, detail: 'This week' }]}
    />
  ));
  expect(view.container.querySelector('dl > div > span')).toBeNull();
  expect(view.container.querySelectorAll('dd').length).toBe(2);
  view.unmount();
});

// regression: ui-switch-visible-label-unnamed
test('the switch uses its visible label as its accessible name', () => {
  renderUi(() => (
    <Switch
      label="Notifications"
      value={false}
      onValueChange={() => undefined}
    />
  ));
  expect(screen.getByRole('switch', { name: 'Notifications' })).toHaveAttribute(
    'aria-checked',
    'false'
  );
});
