/**
 * The sequential focus order agrees with a model of HTML § 6.6.3 built from
 * the page's description alone, on random pages; and Tab / Shift+Tab walk it.
 */

import { describe, expect, test } from 'bun:test';
import {
  nextInFocusOrder,
  sequentialFocusOrder,
} from '@pkgs/a11y-shared-ts/focus';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { page } from './dom';
import type { NodeSpec } from './tree-arbitrary';
import { arbPage, build, walk } from './tree-arbitrary';

const NATIVE = new Set([
  'button',
  'a-href',
  'input-text',
  'input-checkbox',
  'textarea',
  'select',
]);
const DISABLEABLE = new Set([
  'button',
  'input-text',
  'input-checkbox',
  'input-hidden',
  'textarea',
  'select',
]);

function modelTabIndex(node: NodeSpec): number | null {
  if (node.tabindex !== null && /^-?\d+$/.test(node.tabindex)) {
    return Number(node.tabindex);
  }
  return NATIVE.has(node.tag) ? 0 : null;
}

/** HTML's order, computed from the description: no DOM involved. */
function modelOrder(nodes: readonly NodeSpec[]): string[] {
  const stops: { id: string; index: number; tabindex: number }[] = [];
  walk(nodes, false, (node, id, hiddenAbove) => {
    const hidden =
      hiddenAbove ||
      node.hide === 'hidden' ||
      node.hide === 'display' ||
      node.hide === 'inert';
    const tabindex = modelTabIndex(node);
    const disabled = node.disabled && DISABLEABLE.has(node.tag);
    const unrendered = node.tag === 'input-hidden';
    if (
      !hidden &&
      !disabled &&
      !unrendered &&
      tabindex !== null &&
      tabindex >= 0
    ) {
      stops.push({ id, index: stops.length, tabindex });
    }
    return hidden;
  });
  const positive = stops
    .filter((stop) => stop.tabindex > 0)
    .sort((a, b) => a.tabindex - b.tabindex || a.index - b.index);
  const zero = stops.filter((stop) => stop.tabindex === 0);
  return [...positive, ...zero].map((stop) => stop.id);
}

function ids(elements: readonly (Element | null)[]): string[] {
  return elements.map((element) => element?.id ?? 'null');
}

describe('sequential focus order (property)', () => {
  test('equals the model: every stop once, positive tabindex first, then tree order', () => {
    assertProperty(
      'focus order model',
      fc.property(arbPage, (nodes) => {
        const document = page();
        build(document, nodes);
        expect(ids(sequentialFocusOrder(document.body))).toEqual(
          modelOrder(nodes)
        );
      })
    );
  });

  test('Tab from the start visits the order then leaves; Shift+Tab visits it backwards', () => {
    assertProperty(
      'tab walk',
      fc.property(arbPage, (nodes) => {
        const document = page();
        build(document, nodes);
        const root = document.body;
        const order = sequentialFocusOrder(root);
        const forward: Element[] = [];
        const backward: Element[] = [];
        for (
          let at = nextInFocusOrder(root, root);
          at !== null;
          at = nextInFocusOrder(root, at)
        ) {
          forward.push(at);
          if (forward.length > order.length) break;
        }
        for (
          let at = nextInFocusOrder(root, root, true);
          at !== null;
          at = nextInFocusOrder(root, at, true)
        ) {
          backward.push(at);
          if (backward.length > order.length) break;
        }
        expect(ids(forward)).toEqual(ids(order));
        expect(ids(backward)).toEqual(ids([...order].reverse()));
      })
    );
  });
});
