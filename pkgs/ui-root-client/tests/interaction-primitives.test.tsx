/** @jsxImportSource solid-js */
/**
 * `Pressable`, the element handles that replace DOM refs, and the one
 * function an app entry mounts with.
 */

import { describe, expect, test } from 'bun:test';
import { eventConstructor } from '@pkgs/bun-test-solid-client/native-event';
import { createFocusTarget } from '@pkgs/ui-root-client/focus';
import { createMeasure } from '@pkgs/ui-root-client/measure';
import { mountApplication } from '@pkgs/ui-root-client/mount';
import { Pressable } from '@pkgs/ui-root-client/pressable';
import { createScrollTarget } from '@pkgs/ui-root-client/scroll';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import { fireEvent, render } from '@solidjs/testing-library';
import { createEffect, createSignal, For, Show } from 'solid-js';

function byTestId(testId: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-testid="${testId}"]`
  );
  if (element === null) throw new Error(`no element ${testId}`);
  return element;
}

describe('Pressable', () => {
  test('a button by default: press, toggle and current state as ARIA', () => {
    let presses = 0;
    const [on, setOn] = createSignal(false);
    render(() => (
      <Pressable
        testId="p"
        onPress={() => {
          presses += 1;
          setOn((value) => !value);
        }}
        pressed={on()}
        selected={on()}
        aria-label="Follow"
        aria-expanded={on()}
        aria-controls="menu"
        aria-haspopup="menu"
        direction="horizontal"
        align="center"
        gap="sm"
        paddingX="lg"
        radius="control"
        minHeight="row"
        grow
      />
    ));
    const button = byTestId('p');
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('data-component')).toBe('Pressable');
    expect([...button.classList]).toEqual([
      'clickable',
      'clickableTint',
      'flex-row',
      'items-center',
      'flex-1',
      'min-h-ui-control-lg',
      'gap-ui-sm',
      'px-ui-lg',
      'rounded-control',
    ]);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.hasAttribute('aria-current')).toBe(false);
    fireEvent.click(button);
    expect(presses).toBe(1);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-current')).toBe('true');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe('menu');
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-label')).toBe('Follow');
  });

  test('disabled swallows presses and drops the tint', () => {
    let presses = 0;
    render(() => (
      <Pressable testId="p" disabled tint onPress={() => (presses += 1)} />
    ));
    const button = byTestId('p') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(presses).toBe(0);
    expect([...button.classList]).toEqual([
      'clickable',
      'flex-col',
      'opacity-disabled',
      'cursor-default',
    ]);
  });

  test('href makes it a link; onPress takes a plain click, not a modified one', () => {
    let presses = 0;
    render(() => (
      <>
        <Pressable testId="plain" href="/games" current="page" />
        <Pressable
          testId="handled"
          href="/games"
          onPress={() => (presses += 1)}
        />
        <Pressable testId="off" href="/games" disabled />
      </>
    ));
    const plain = byTestId('plain');
    expect(plain.tagName).toBe('A');
    expect(plain.getAttribute('href')).toBe('/games');
    expect(plain.getAttribute('aria-current')).toBe('page');
    const handled = byTestId('handled');
    expect(fireEvent.click(handled)).toBe(false);
    expect(presses).toBe(1);
    expect(fireEvent.click(handled, { metaKey: true })).toBe(true);
    expect(presses).toBe(1);
    const off = byTestId('off');
    expect(off.hasAttribute('href')).toBe(false);
    expect(off.getAttribute('aria-disabled')).toBe('true');
  });

  test('focus changes are reported, and tabStop false leaves the tab order', () => {
    const seen: boolean[] = [];
    render(() => (
      <Pressable
        testId="p"
        tabStop={false}
        onFocusChange={(focused) => seen.push(focused)}
      />
    ));
    const button = byTestId('p');
    expect(button.getAttribute('tabindex')).toBe('-1');
    button.focus();
    button.blur();
    expect(seen).toEqual([true, false]);
  });
});

describe('focus targets', () => {
  test('focus moves to whichever component holds the target', () => {
    const [value, setValue] = createSignal('');
    const [shown, setShown] = createSignal(true);
    const field = createFocusTarget();
    const region = createFocusTarget();
    const unheld = createFocusTarget();
    render(() => (
      <>
        <Show when={shown()}>
          <TextInput
            focusTarget={field.target}
            value={value()}
            onChangeText={setValue}
            label="Name"
          />
        </Show>
        <Pressable testId="region" focusTarget={region.target} />
      </>
    ));
    expect(unheld.focus()).toBe(false);
    expect(unheld.mounted()).toBe(false);
    expect(field.focus()).toBe(true);
    expect(document.activeElement?.tagName).toBe('INPUT');
    expect(region.focus()).toBe(true);
    expect(document.activeElement).toBe(byTestId('region'));
    region.blur();
    expect(document.activeElement).not.toBe(byTestId('region'));
    setShown(false);
    expect(field.mounted()).toBe(false);
    expect(field.focus()).toBe(false);
  });
});

describe('scroll targets', () => {
  test('an effect reveals the component the target moves to', () => {
    const [selected, setSelected] = createSignal(0);
    const current = createScrollTarget();
    const revealed: string[] = [];
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = function scrollIntoView(
      this: HTMLElement
    ): void {
      revealed.push(this.getAttribute('data-testid') ?? '');
    };
    try {
      render(() => {
        createEffect(() => {
          selected();
          current.scrollIntoView({ inline: 'center' });
        });
        return (
          <For each={[0, 1, 2]}>
            {(index) => (
              <StackVertical
                testId={`item-${index}`}
                scrollTarget={index === selected() ? current.target : undefined}
              />
            )}
          </For>
        );
      });
      expect(revealed.at(-1)).toBe('item-0');
      setSelected(2);
      expect(revealed.at(-1)).toBe('item-2');
      expect(revealed).not.toContain('item-1');
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });

  test('scrolling an unheld target does nothing', () => {
    expect(createScrollTarget().scrollIntoView()).toBe(false);
  });
});

describe('measure', () => {
  test('reports the held component in whole px and follows layout events', () => {
    let size = { width: 320.7, height: 200.2 };
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function rect(): DOMRect {
      return {
        ...size,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      } as DOMRect;
    };
    try {
      const seen: string[] = [];
      render(() => {
        const frame = createMeasure();
        createEffect(() => seen.push(`${frame.width()}x${frame.height()}`));
        return <StackVertical testId="frame" measureTarget={frame.target} />;
      });
      expect(seen.at(-1)).toBe('320x200');
      size = { width: 480, height: 300 };
      byTestId('frame').dispatchEvent(new Event('ui-testing:element-layout'));
      expect(seen.at(-1)).toBe('480x300');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  });
});

/** `window` keeps the runner's own dispatcher, which takes its own events. */
function hidePage(): void {
  const PageEvent = eventConstructor(window);
  window.dispatchEvent(new PageEvent('pagehide'));
}

describe('mountApplication', () => {
  test('renders into the mount element, replacing the boot markup', () => {
    const host = document.createElement('div');
    host.id = 'root';
    host.innerHTML = '<p>Loading</p>';
    document.body.append(host);
    let hidden = 0;
    const unmount = mountApplication(() => <StackVertical testId="app" />, {
      onPageHide: () => (hidden += 1),
    });
    expect(host.textContent).toBe('');
    expect(host.querySelector('[data-testid="app"]')).not.toBeNull();
    hidePage();
    expect(hidden).toBe(1);
    unmount();
    expect(host.querySelector('[data-testid="app"]')).toBeNull();
    hidePage();
    expect(hidden).toBe(1);
    host.remove();
  });

  test('a missing mount element is an error, not a silent blank page', () => {
    expect(() =>
      mountApplication(() => <StackVertical />, { rootId: 'absent' })
    ).toThrow('no #absent element');
  });
});
