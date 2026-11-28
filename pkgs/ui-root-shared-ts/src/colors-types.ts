import type { TokenName } from './design-tokens';
import type { color } from './design-tokens.json';

export type ColorTokenName = TokenName<typeof color>;
export type ColorTokens = Readonly<Record<ColorTokenName, string>>;
