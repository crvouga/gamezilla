import { fireEvent } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

type ScrollDirection = 'up' | 'down' | 'left' | 'right';

const SCROLL_AXIS: Record<
  ScrollDirection,
  { prop: 'scrollTop' | 'scrollLeft'; sign: 1 | -1 }
> = {
  down: { prop: 'scrollTop', sign: 1 },
  up: { prop: 'scrollTop', sign: -1 },
  right: { prop: 'scrollLeft', sign: 1 },
  left: { prop: 'scrollLeft', sign: -1 },
};

export async function tapElement(element: Element): Promise<void> {
  const user = userEvent.setup();
  try {
    await user.click(element as HTMLElement);
  } catch {
    fireEvent.click(element);
  }
}

export async function tapElementAt(
  element: Element,
  position: { xRatio: number; yRatio: number }
): Promise<void> {
  const node = element as HTMLElement;
  const rect = node.getBoundingClientRect();
  const clientX = rect.left + rect.width * position.xRatio;
  const clientY = rect.top + rect.height * position.yRatio;
  fireEvent.click(node, { clientX, clientY, bubbles: true });
}

export async function typeIntoElement(
  element: Element,
  text: string
): Promise<void> {
  const target = asEditable(element);
  const user = userEvent.setup();
  target.focus();
  try {
    await user.type(target, text);
  } catch {
    fireEvent.change(target, {
      target: { value: `${target.value}${text}` },
    });
  }
}

export async function clearElement(element: Element): Promise<void> {
  const target = asEditable(element);
  const user = userEvent.setup();
  target.focus();
  try {
    await user.clear(target);
  } catch {
    fireEvent.change(target, { target: { value: '' } });
  }
}

export async function pressDomKey(domKey: string): Promise<void> {
  const user = userEvent.setup();
  const active = document.activeElement ?? document.body;
  try {
    await user.keyboard(`{${domKey}}`);
  } catch {
    fireEvent.keyDown(active, { key: domKey });
    fireEvent.keyUp(active, { key: domKey });
  }
}

export async function scrollElement(
  element: Element,
  direction: ScrollDirection,
  amount: number
): Promise<void> {
  const { prop, sign } = SCROLL_AXIS[direction];
  const node = element as HTMLElement;
  node[prop] = (node[prop] ?? 0) + sign * amount;
  fireEvent.scroll(node);
}

function asEditable(element: Element): HTMLInputElement | HTMLTextAreaElement {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return element;
  }
  const nested = element.querySelector('input, textarea');
  if (
    nested instanceof HTMLInputElement ||
    nested instanceof HTMLTextAreaElement
  ) {
    return nested;
  }
  throw new Error('Target is not an editable input');
}
