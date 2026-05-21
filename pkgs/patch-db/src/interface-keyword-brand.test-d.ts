import type { PatchInput } from './interface';

declare function takeAttributes(attrs: PatchInput['attributes']): void;

// @ts-expect-error Tiger: attribute map keys must be branded {@link Keyword}s, not string literals
takeAttributes({ 'todo/title': 'nope' });
