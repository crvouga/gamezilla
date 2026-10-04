import { UiTestError } from './ui-test-error';

/** A selector matched nothing (or too many elements) when one was required. */
export class ElementNotFoundError extends UiTestError {
  readonly selectorDescription: string;

  constructor(selectorDescription: string, detail?: string) {
    const suffix = detail ? ` — ${detail}` : '';
    super(`Element not found: ${selectorDescription}${suffix}`);
    this.name = 'ElementNotFoundError';
    this.selectorDescription = selectorDescription;
  }
}
