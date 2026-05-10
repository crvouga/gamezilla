/**
 * Ensures `t` / `useLingui().t` are typed as {@link LocalizedString} for branded props.
 * Import this module from the UI package entry so dependents resolve the augmentation.
 */
import type { I18n, MessageDescriptor } from '@lingui/core';
import type { LocalizedString } from './localized-string';

declare module '@lingui/core/macro' {
  export function t(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): LocalizedString;
  export function t(descriptor: MessageDescriptor): LocalizedString;
}

declare module '@lingui/react/macro' {
  export function useLingui(): {
    t: (strings: TemplateStringsArray, ...values: unknown[]) => LocalizedString;
    i18n: I18n;
  };
}

export {};
