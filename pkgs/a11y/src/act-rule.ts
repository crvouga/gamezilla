/**
 * The shape of an ACT rule (W3C Accessibility Conformance Testing Rules
 * Format 1.0): an applicability over elements and an expectation each
 * applicable element must meet, with the WCAG 2.2 success criteria it tests.
 */

export type ActRule = {
  /** The rule's id in the W3C ACT Rules repository (`97a4e1`). */
  readonly id: string;
  readonly title: string;
  /** WCAG 2.2 success criteria the rule tests (`4.1.2`). */
  readonly wcag: readonly string[];
  readonly applicable: (element: Element) => boolean;
  readonly passes: (element: Element) => boolean;
};

/** An applicable element that fails its rule's expectation. */
export type ActFailure = {
  readonly rule: string;
  readonly title: string;
  readonly wcag: readonly string[];
  /** The failing element, as a listener hears it (`button ""`). */
  readonly target: string;
};
