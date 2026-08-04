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

export type Selector =
  | { kind: 'testId'; value: string }
  | { kind: 'text'; value: string; exact?: boolean }
  | { kind: 'label'; value: string }
  | { kind: 'role'; role: SelectorRole; name?: string };

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
