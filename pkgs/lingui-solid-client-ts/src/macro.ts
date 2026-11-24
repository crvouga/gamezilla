/**
 * Compile-time Lingui macros for Solid. `@lingui/babel-plugin-lingui-macro`
 * rewrites every import of this module (`macro.jsxPackage` in
 * `lingui.config.ts`) into `./runtime` calls, so nothing here runs in a
 * compiled build.
 */

import type {
  LabeledExpression,
  MacroMessageDescriptor,
} from '@lingui/core/macro';
import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import type { JSX } from '@solidjs/web';
import type { I18nContext } from './runtime';

type CommonProps = {
  id?: string;
  comment?: string;
  context?: string;
};

type TransChildren = JSX.Element | LabeledExpression<string | number>;

type TransProps = CommonProps & {
  children: TransChildren | TransChildren[];
};

type PluralChoiceProps = CommonProps & {
  value: string | number | LabeledExpression<string | number>;
  offset?: number;
  zero?: JSX.Element;
  one?: JSX.Element;
  two?: JSX.Element;
  few?: JSX.Element;
  many?: JSX.Element;
  other: JSX.Element;
  [digit: `_${number}`]: JSX.Element;
};

type SelectChoiceProps = CommonProps & {
  value: string | LabeledExpression<string | number>;
  other: JSX.Element;
  [option: `_${string}`]: JSX.Element;
};

type LinguiMacro = Omit<I18nContext, '_'> & {
  t: {
    (descriptor: MacroMessageDescriptor): LocalizedString;
    (
      literals: TemplateStringsArray,
      ...placeholders: unknown[]
    ): LocalizedString;
  };
};

function uncompiled(): never {
  throw new Error(
    'A Lingui macro ran uncompiled: this module was loaded without @lingui/babel-plugin-lingui-macro.'
  );
}

export const Trans: (props: TransProps) => JSX.Element = uncompiled;
export const Plural: (props: PluralChoiceProps) => JSX.Element = uncompiled;
export const SelectOrdinal: (props: PluralChoiceProps) => JSX.Element =
  uncompiled;
export const Select: (props: SelectChoiceProps) => JSX.Element = uncompiled;
export const useLingui: () => LinguiMacro = uncompiled;
