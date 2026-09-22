/**
 * Provider errors, in the wire's `{ error: { type, code, message } }`
 * envelope with the HTTP status a real provider would answer with.
 */
import type { MockErrorBody, MockErrorType } from '@pkgs/billing-mock/wire';

const STATUS: Readonly<Record<MockErrorType, number>> = {
  invalid_request_error: 400,
  authentication_error: 401,
  card_error: 402,
  idempotency_error: 400,
  rate_limit_error: 429,
  api_error: 500,
};

export class ProviderError extends Error {
  readonly status: number;

  constructor(
    readonly body: MockErrorBody['error'],
    status?: number
  ) {
    super(body.message);
    this.name = 'ProviderError';
    this.status = status ?? STATUS[body.type];
  }

  toBody(): MockErrorBody {
    return { error: this.body };
  }
}

export function invalidRequest(message: string, param?: string): ProviderError {
  return new ProviderError({
    type: 'invalid_request_error',
    message,
    ...(param === undefined ? {} : { param }),
  });
}

export function resourceMissing(kind: string, id: string): ProviderError {
  return new ProviderError(
    {
      type: 'invalid_request_error',
      code: 'resource_missing',
      message: `No such ${kind}: '${id}'`,
    },
    404
  );
}

export function sessionExpired(message: string): ProviderError {
  return new ProviderError(
    { type: 'invalid_request_error', code: 'session_expired', message },
    410
  );
}

export function cardDeclined(): ProviderError {
  return new ProviderError({
    type: 'card_error',
    code: 'card_declined',
    decline_code: 'generic_decline',
    message: 'Your card was declined.',
  });
}

/** An off-session charge on a card that needs the customer to authenticate. */
export function authenticationRequired(): ProviderError {
  return new ProviderError({
    type: 'card_error',
    code: 'authentication_required',
    decline_code: 'authentication_required',
    message:
      'Your card was declined. This transaction requires authentication.',
  });
}

export function paymentMethodRequired(): ProviderError {
  return new ProviderError({
    type: 'invalid_request_error',
    code: 'payment_method_required',
    param: 'payment_method',
    message: 'This checkout session requires a payment method.',
  });
}

/** An `Idempotency-Key` reused with different parameters. */
export function idempotencyMismatch(key: string): ProviderError {
  return new ProviderError({
    type: 'idempotency_error',
    message: `Keys for idempotent requests can only be used with the same parameters they were first used with. Try using a key other than '${key}' if you meant to execute a different request.`,
  });
}

export function unrecognizedUrl(method: string, path: string): ProviderError {
  return new ProviderError(
    {
      type: 'invalid_request_error',
      message: `Unrecognized request URL (${method}: ${path}).`,
    },
    404
  );
}

export function authenticationFailed(): ProviderError {
  return new ProviderError({
    type: 'authentication_error',
    message: 'Invalid API Key provided.',
  });
}
