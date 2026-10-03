import type { PicomatchOptions } from 'picomatch';

export type GlobOptions = PicomatchOptions & { lookbehinds?: boolean };
export function any(
  input: string,
  patterns: string | readonly string[],
  options?: GlobOptions
): boolean;
export function makeRe(pattern: string, options?: GlobOptions): RegExp;
export function capture(
  pattern: string,
  input: string,
  options?: GlobOptions
): string[] | null;
declare const glob: {
  any: typeof any;
  makeRe: typeof makeRe;
  capture: typeof capture;
};
export default glob;
