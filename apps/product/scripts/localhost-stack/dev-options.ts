// @io-wall-ok — development process environment.
import { parseStackOptions } from './stack-options';

export function devStackOptions() {
  const args: unknown = JSON.parse(
    process.env['LOCALHOST_STACK_ARGS'] ?? '["--instance","dev"]'
  );
  if (
    !Array.isArray(args) ||
    !args.every((arg): arg is string => typeof arg === 'string')
  ) {
    throw new Error('LOCALHOST_STACK_ARGS must be a JSON array of strings');
  }
  return parseStackOptions(args);
}
