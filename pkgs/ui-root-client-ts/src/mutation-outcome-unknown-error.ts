/** An observation deadline is not a rejection or cancellation of the choice. */
export class MutationOutcomeUnknownError extends Error {
  override readonly name = 'MutationOutcomeUnknownError';
  constructor() {
    super(
      'This choice has not been confirmed yet. You can close this and keep using the app.'
    );
  }
}
