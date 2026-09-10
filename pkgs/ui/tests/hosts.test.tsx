/** @jsxImportSource solid-js */
import {
  Checkbox,
  Clickable,
  ContentEdgePaddingProvider,
  GradientBox,
  Motion,
  ScrollView,
  Switch,
  Text,
  TextInput,
  VirtualList,
} from '@pkgs/ui';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';
import { cssOf, renderUi } from './support/render';

describe('Clickable', () => {
  test('renders a real button with tint feedback and forwards clicks', () => {
    const onClick = vi.fn();
    renderUi(() => (
      <Clickable data-testid="c" onClick={onClick} class="p-2">
        <Text label="Go" />
      </Clickable>
    ));
    const el = screen.getByTestId('c');
    expect(el.tagName).toBe('BUTTON');
    expect(el).toHaveAttribute('type', 'button');
    expect(el.className).toMatch(/clickableTint/);
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('disabled buttons and feedback modes', () => {
    renderUi(() => <Clickable data-testid="c" disabled feedback="opacity" />);
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
    fireEvent.click(el);
    expect(el).toHaveAttribute('aria-checked', 'true');
    expect(el.className).toMatch(/min-h-\[44px\]/);
  });
});

describe('Checkbox', () => {
  test('tri-state aria + toggling semantics', () => {
    const onToggle = vi.fn();
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
  test('controlled value, label, error and submit', () => {
    const [value, setValue] = createSignal('');
    const onSubmit = vi.fn();
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

  test('multiline renders a textarea and masks secure entry', () => {
    renderUi(() => (
      <>
        <TextInput value="" onChangeText={() => {}} multiline rows={4} />
        <TextInput
          value=""
          onChangeText={() => {}}
          secureTextEntry
          aria-label={'pw' as never}
        />
      </>
    ));
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('pw')).toHaveAttribute('type', 'password');
  });
});

describe('ScrollView', () => {
  test('styles frame and content separately and bleeds under shell padding', () => {
    renderUi(() => (
      <ContentEdgePaddingProvider step={4}>
        <ScrollView
          data-testid="sv"
          class="flex-1"
          contentStyle={{ gap: 'var(--ui-space-2)' }}
        >
          <Text label="row" />
        </ScrollView>
      </ContentEdgePaddingProvider>
    ));
    const frame = screen.getByTestId('sv');
    expect(frame.className).toMatch(/scroll/);
    expect(frame.className).toMatch(/flex-1/);
    const content = frame.firstElementChild as HTMLElement;
    expect(cssOf(content)).toContain('gap:var(--ui-space-2)');
    const wrapper = frame.parentElement;
    if (wrapper === null) throw new Error('wrapper missing');
    expect(wrapper.className).toMatch(/flex-1/);
  });
});

describe('VirtualList', () => {
  test('windows rows and renders header/footer/empty', () => {
    const items = Array.from({ length: 200 }, (_, i) => ({ id: `r${i}` }));
    renderUi(() => (
      <VirtualList
        data-testid="vl"
        items={items}
        keyExtractor={(it) => it.id}
        renderItem={(it) => <Text label={it.id} />}
        estimateSize={40}
        fixedViewport={{ width: 300, height: 200 }}
        header={<Text label="head" />}
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
        renderItem={(it) => <Text label={it.id} />}
        empty={<Text label="nothing" />}
        fixedViewport={{ width: 300, height: 200 }}
      />
    ));
    expect(screen.getByText('nothing')).toBeInTheDocument();
  });
});

describe('GradientBox', () => {
  test('paints a linear gradient and provides on-color to children', () => {
    renderUi(() => (
      <GradientBox data-testid="g" colors={['#000000', '#111111']}>
        <Text data-testid="t" label="on gradient" />
      </GradientBox>
    ));
    expect(cssOf(screen.getByTestId('g'))).toContain(
      'background-image:linear-gradient(90deg,#000000,#111111)'
    );
    expect(cssOf(screen.getByTestId('t'))).toContain(
      'color:var(--ui-color-on-primary)'
    );
  });
});

describe('Motion', () => {
  test('emits transition declarations and unmounts after exit', () => {
    const [present, setPresent] = createSignal(true);
    const { clock } = renderUi(() => (
      <Motion data-testid="m" present={present()} style={{ opacity: 1 }} />
    ));
    const el = screen.getByTestId('m');
    expect(cssOf(el)).toContain('transition-property:all');
    expect(cssOf(el)).toContain(
      'transition-duration:var(--ui-duration-normal)'
    );
    setPresent(false);
    expect(screen.getByTestId('m')).toBeInTheDocument();
    expect(cssOf(screen.getByTestId('m'))).toContain('opacity:0');
    clock.advance(1000);
    expect(screen.queryByTestId('m')).toBeNull();
  });
});
