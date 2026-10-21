/** The sequential focus order on hand-picked pages (HTML § 6.6.3). */

import { describe, expect, test } from 'bun:test';
import {
  isFocusable,
  nextInFocusOrder,
  parseTabIndex,
  sequentialFocusOrder,
} from '@pkgs/a11y-shared-ts/focus';
import { byId, page } from './dom';

function ids(elements: readonly Element[]): string[] {
  return elements.map((element) => element.id);
}

describe('sequential focus order', () => {
  test('positive tabindex first, ascending, ties in tree order; then tree order', () => {
    const document = page(
      '<button id="a"></button><span id="b" tabindex="2"></span><a id="c" href="#"></a><input id="d" tabindex="1"><div id="e" tabindex="2"></div>'
    );
    expect(ids(sequentialFocusOrder(document.body))).toEqual([
      'd',
      'b',
      'e',
      'a',
      'c',
    ]);
  });

  test('disabled, inert, hidden, unrendered and tabindex -1 are skipped', () => {
    const document = page(
      '<button id="a" disabled></button><div inert><button id="b"></button></div><button id="c" hidden></button><div style="display:none"><a id="d" href="#"></a></div><button id="e" tabindex="-1"></button><input id="f" type="hidden"><a id="g">no href</a><button id="h"></button><fieldset disabled><legend><button id="i"></button></legend><button id="j"></button></fieldset>'
    );
    expect(ids(sequentialFocusOrder(document.body))).toEqual(['h', 'i']);
  });

  test('visibility hidden is skipped unless a descendant is visible again', () => {
    const document = page(
      '<div style="visibility:hidden"><button id="a"></button><button id="b" style="visibility:visible"></button></div>'
    );
    expect(ids(sequentialFocusOrder(document.body))).toEqual(['b']);
  });

  test('aria-hidden does not take an element out of the order', () => {
    const document = page(
      '<div aria-hidden="true"><button id="a"></button></div>'
    );
    expect(ids(sequentialFocusOrder(document.body))).toEqual(['a']);
  });

  test('a radio group is one stop: the checked radio, else the first', () => {
    const document = page(
      '<input type="radio" name="x" id="a"><input type="radio" name="x" id="b" checked><input type="radio" name="y" id="c"><input type="radio" name="y" id="d"><input type="radio" id="e">'
    );
    expect(ids(sequentialFocusOrder(document.body))).toEqual(['b', 'c', 'e']);
  });

  test('summary of details and contenteditable are focusable', () => {
    const document = page(
      '<details><summary id="a">More</summary></details><div id="b" contenteditable="true"></div><summary id="c">loose</summary>'
    );
    expect(ids(sequentialFocusOrder(document.body))).toEqual(['a', 'b']);
  });

  test('tabindex parses as an HTML integer', () => {
    expect(parseTabIndex(' 3x')).toBe(3);
    expect(parseTabIndex('+1')).toBe(1);
    expect(parseTabIndex('-1')).toBe(-1);
    expect(parseTabIndex('x')).toBeNull();
    expect(parseTabIndex('')).toBeNull();
  });

  test('tabindex -1 is focusable but not in the order', () => {
    const document = page('<div id="a" tabindex="-1"></div>');
    expect(isFocusable(byId(document, 'a'))).toBe(true);
    expect(sequentialFocusOrder(document.body)).toEqual([]);
  });
});

describe('next in focus order', () => {
  const html =
    '<button id="a"></button><div id="x" tabindex="-1"><button id="b"></button></div><button id="c"></button>';

  test('Tab and Shift+Tab step through the order and leave past the ends', () => {
    const document = page(html);
    const root = document.body;
    expect(nextInFocusOrder(root, null)?.id).toBe('a');
    expect(nextInFocusOrder(root, byId(document, 'a'))?.id).toBe('b');
    expect(nextInFocusOrder(root, byId(document, 'c'))).toBeNull();
    expect(nextInFocusOrder(root, byId(document, 'a'), true)).toBeNull();
    expect(nextInFocusOrder(root, root, true)?.id).toBe('c');
  });

  test('from a tabindex -1 element, Tab goes to the next stop in tree order', () => {
    const document = page(html);
    const root = document.body;
    expect(nextInFocusOrder(root, byId(document, 'x'))?.id).toBe('b');
    expect(nextInFocusOrder(root, byId(document, 'x'), true)?.id).toBe('a');
  });
});
