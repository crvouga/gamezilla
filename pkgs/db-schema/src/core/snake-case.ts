/**
 * snake_case grammar for schema identifiers:
 * - first char: lowercase letter
 * - rest: lowercase letters, digits, underscore
 * - no leading/trailing underscore
 * - no consecutive `__`
 * - ≤63 UTF-8 bytes (Postgres NAMEDATALEN-1)
 */

type LowercaseLetter =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z';

type SnakeRestChar =
  | LowercaseLetter
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '_';

type HasDoubleUnderscore<S extends string> = S extends `${string}__${string}`
  ? true
  : false;

type EndsWithUnderscore<S extends string> = S extends `${string}_`
  ? true
  : false;

type RestOk<S extends string> = S extends `${infer C}${infer R}`
  ? C extends SnakeRestChar
    ? RestOk<R>
    : false
  : true;

/**
 * Returns `S` when it matches snake_case; otherwise a branded error object
 * (so illegal keys fail assignability with a readable hover message).
 */
export type AssertSnakeCase<S extends string> = S extends `${infer H}${infer R}`
  ? H extends LowercaseLetter
    ? RestOk<R> extends true
      ? HasDoubleUnderscore<S> extends true
        ? { readonly __error: `identifier '${S}' must not contain '__'` }
        : EndsWithUnderscore<S> extends true
          ? { readonly __error: `identifier '${S}' must not end with '_'` }
          : S
      : { readonly __error: `identifier '${S}' is not snake_case` }
    : {
        readonly __error: `identifier '${S}' must start with a lowercase letter`;
      }
  : { readonly __error: `identifier '${S}' is not snake_case` };

export type IsSnakeCase<S extends string> =
  AssertSnakeCase<S> extends S ? true : false;

const SNAKE_CASE_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const MAX_IDENT_BYTES = 63;
const encoder = new TextEncoder();

export function isSnakeCase(value: string): boolean {
  return SNAKE_CASE_RE.test(value);
}

export function identByteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

export function assertSnakeCaseIdent(
  value: string,
  path: string
): asserts value is string {
  if (!isSnakeCase(value)) {
    throw new Error(
      `${path}: identifier '${value}' must be snake_case (lowercase letter start; lowercase/digits/underscore; no leading/trailing '_'; no '__')`
    );
  }
  if (identByteLength(value) > MAX_IDENT_BYTES) {
    throw new Error(
      `${path}: identifier '${value}' exceeds ${MAX_IDENT_BYTES}-byte limit`
    );
  }
}
