import type { Attributes } from './attributes';
import {
  type ErrorReproduction,
  errorReproduction,
} from './error-reproduction';

/** Opt-in replay details travel with the original error through existing root boundaries. */
export class ReproducibleError extends Error {
  readonly diagnostic: Readonly<Attributes>;

  constructor(
    message: string,
    options: ErrorOptions,
    reproduction: ErrorReproduction
  ) {
    super(message, options);
    this.name = 'ReproducibleError';
    this.diagnostic = Object.freeze(errorReproduction(reproduction));
    Object.defineProperty(this, 'diagnostic', {
      enumerable: false,
      writable: false,
    });
  }
}

export function reproductionAttributes(error: unknown): Attributes {
  return error instanceof ReproducibleError ? error.diagnostic : {};
}
