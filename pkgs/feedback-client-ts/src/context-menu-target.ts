import { accessibleName } from '@pkgs/a11y-shared-ts/accessible-name';
import { roleOf } from '@pkgs/a11y-shared-ts/roles';
import {
  MAX_SUBJECT_SELECTION,
  MAX_SUBJECT_TEST_IDS,
} from '@pkgs/feedback-shared-ts/bug-report';
import type { BugReportSubject } from '@pkgs/feedback-shared-ts/types';

/** Where a page keeps the browser's own menu: its own right-click, or none of ours. */
export const NATIVE_CONTEXT_MENU = '[data-native-context-menu]';
/** The bug report itself, and anything an app marks private. */
const PRIVATE = '[data-feedback-root], [data-feedback-private]';
/** A thing a person points at on purpose: a control, a picture, or something the app named. */
const THING =
  'button, a[href], summary, select, input, textarea, [contenteditable=""], [contenteditable="true"], img, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"], [role="slider"], [data-testid]';
const FIELD =
  'textarea, select, [contenteditable=""], [contenteditable="true"], input';
const PRESSED_INPUT =
  /^(button|submit|reset|checkbox|radio|image|file|color|range)$/;
const MAX_NAME = 200;

/** What a right-click landed on, as far as the menu cares. */
export type MenuTarget = {
  /** What a bug report from this menu is about. */
  readonly subject: Element;
  /** A field the person types in, with what they selected in it. */
  readonly field: {
    readonly element: Element;
    readonly selected: string;
  } | null;
  /** Words selected on the page, outside any field. */
  readonly selection: string | null;
  readonly link: { readonly element: Element; readonly href: string } | null;
  readonly image: string | null;
};

function typedInto(element: Element): boolean {
  if (!element.matches(FIELD)) return false;
  return (
    !element.matches('input') ||
    !PRESSED_INPUT.test(element.getAttribute('type') ?? 'text')
  );
}

/** The field a person types in that holds `element`, if any. */
export function fieldOf(element: Element): Element | null {
  const field = element.closest(FIELD);
  return field && typedInto(field) ? field : null;
}

type TextField = {
  readonly value: string;
  readonly selectionStart: number | null;
  readonly selectionEnd: number | null;
};

function fieldSelection(field: Element): string {
  if (!('selectionStart' in field && 'value' in field))
    return field.ownerDocument.getSelection()?.toString() ?? '';
  const text = field as unknown as TextField;
  // A field that keeps no selection (email, number) has nothing selected to copy.
  return text.selectionStart === null || text.selectionEnd === null
    ? ''
    : text.value.slice(text.selectionStart, text.selectionEnd);
}

/** Words selected on the page, never inside a field or anything private. */
function pageSelection(document: Document): string | null {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed) return null;
  const anchor = selection.anchorNode;
  const from = anchor instanceof Element ? anchor : anchor?.parentElement;
  if (!from || fieldOf(from) || from.closest(PRIVATE)) return null;
  const text = selection.toString().trim();
  return text === '' ? null : text;
}

function imageSource(image: Element | null): string | null {
  if (!image) return null;
  const { currentSrc, src } = image as HTMLImageElement;
  return currentSrc || src || null;
}

/**
 * Reads what is under a right-click, or under the focus when the keyboard
 * asked. `null` where the menu is not ours to show: inside the bug report,
 * or where the page keeps the browser's own menu.
 */
export function readMenuTarget(target: Element): MenuTarget | null {
  if (target.closest(PRIVATE) || target.closest(NATIVE_CONTEXT_MENU))
    return null;
  const field = fieldOf(target);
  const link = target.closest('a[href]');
  return {
    subject:
      target.closest(THING) ?? target.closest('[data-component]') ?? target,
    field: field && { element: field, selected: fieldSelection(field) },
    selection: field ? null : pageSelection(target.ownerDocument),
    link: link && { element: link, href: (link as HTMLAnchorElement).href },
    image: imageSource(target.closest('img')),
  };
}

/** Every value typed into a field inside `element`, the field itself included. */
function typedValues(element: Element): string[] {
  return [element, ...element.querySelectorAll(FIELD)]
    .filter(typedInto)
    .map((field) =>
      'value' in field ? String(field.value) : field.textContent
    )
    .map((value) => value.trim())
    .filter((value) => value !== '');
}

/** What a screen reader calls it, unless that would repeat what was typed. */
function safeName(element: Element): string | null {
  const name = accessibleName(element).slice(0, MAX_NAME);
  if (name === '') return null;
  return typedValues(element).some((typed) => name.includes(typed))
    ? null
    : name;
}

function testIdsOf(element: Element): string[] {
  const ids: string[] = [];
  for (
    let node: Element | null = element.closest('[data-testid]');
    node && ids.length < MAX_SUBJECT_TEST_IDS;
    node = node.parentElement?.closest('[data-testid]') ?? null
  )
    ids.push(node.getAttribute('data-testid') ?? '');
  return ids;
}

const round = (value: number): number => Math.round(value);

/**
 * Names the thing a bug report is about the way the app does, with where
 * it was on the screen. What was typed into it is never part of it.
 */
export function describeSubject(
  target: MenuTarget,
  pointer: { readonly x: number; readonly y: number } | null
): BugReportSubject {
  const { subject } = target;
  const view = subject.ownerDocument.defaultView;
  const box = subject.getBoundingClientRect();
  return {
    testIds: testIdsOf(subject),
    component:
      subject.closest('[data-component]')?.getAttribute('data-component') ??
      null,
    screen:
      subject.closest('[data-screen]')?.getAttribute('data-screen') ?? null,
    name: safeName(subject),
    role: roleOf(subject),
    box: {
      x: round(box.x),
      y: round(box.y),
      width: round(box.width),
      height: round(box.height),
    },
    viewport: {
      width: round(view?.innerWidth ?? 0),
      height: round(view?.innerHeight ?? 0),
    },
    pointer: pointer && { x: round(pointer.x), y: round(pointer.y) },
    selectedText: target.selection?.slice(0, MAX_SUBJECT_SELECTION) ?? null,
  };
}
