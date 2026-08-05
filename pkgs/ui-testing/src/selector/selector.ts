/**
 * Portable, application-agnostic selector. Drivers translate these into their
 * native query APIs. Never expose CSS / XPath / Detox matcher objects here.
 */
export type SelectorRole =
  | 'button'
  | 'link'
  | 'textbox'
  | 'checkbox'
  | 'radio'
  | 'heading'
  | 'img'
  | 'list'
  | 'listitem'
  | 'navigation'
  | 'dialog'
  | 'alert'
  | 'switch'
  | 'tab'
  | 'tablist'
  | 'searchbox'
  | 'combobox'
  | 'option'
  | 'menu'
  | 'menuitem';

type SelectorModifiers = {
  /** Zero-based match index when multiple elements match. */
  nth?: number;
};

export type Selector = (
  | { kind: 'testId'; value: string }
  | { kind: 'text'; value: string; exact?: boolean }
  | { kind: 'label'; value: string }
  | { kind: 'role'; role: SelectorRole; name?: string }
) &
  SelectorModifiers;

/** Fluent builders for {@link Selector}. Prefer these over object literals. */
export const by = {
  testId(value: string): Selector {
    return { kind: 'testId', value };
  },
  text(value: string, options?: { exact?: boolean }): Selector {
    if (options?.exact !== undefined) {
      return { kind: 'text', value, exact: options.exact };
    }
    return { kind: 'text', value };
  },
  label(value: string): Selector {
    return { kind: 'label', value };
  },
  role(role: SelectorRole, name?: string): Selector {
    if (name !== undefined) {
      return { kind: 'role', role, name };
    }
    return { kind: 'role', role };
  },
} as const;

/** Select the first match when multiple elements match. */
export function first(selector: Selector): Selector {
  return { ...selector, nth: 0 };
}

/** Select the match at a zero-based index. */
export function nth(selector: Selector, index: number): Selector {
  return { ...selector, nth: index };
}
