export type WriteSuccess<T> = { readonly ok: true; readonly value: T };

export type WriteFailure = {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
  readonly meta?: Readonly<Record<string, unknown>>;
};

export type WriteResult<T> = WriteSuccess<T> | WriteFailure;

export class WriteError extends Error {
  readonly code: string;
  readonly meta: Readonly<Record<string, unknown>> | undefined;

  constructor(failure: WriteFailure) {
    super(failure.message);
    this.name = 'WriteError';
    this.code = failure.code;
    this.meta = failure.meta;
  }
}

export function ok<T>(value: T): WriteSuccess<T> {
  return { ok: true, value };
}

export function fail(
  code: string,
  message: string,
  meta?: Readonly<Record<string, unknown>>
): WriteFailure {
  if (meta === undefined) {
    return { ok: false, code, message };
  }
  return { ok: false, code, message, meta };
}

export function isWriteFailure(
  result: WriteResult<unknown>
): result is WriteFailure {
  return !result.ok;
}

export function unwrap<T>(result: WriteResult<T>): T {
  if (result.ok) {
    return result.value;
  }
  throw new WriteError(result);
}

export function failureToError(result: WriteFailure): WriteError {
  return new WriteError(result);
}
