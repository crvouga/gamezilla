/**
 * Ensures the core `t` macro is typed as {@link LocalizedString} for branded
 * props (`useLingui().t` already is). Import this module from the UI package
 * entry so dependents resolve the augmentation.
 */

import type { MessageDescriptor } from '@lingui/core';
import type {} from '@lingui/core/macro';
import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';

declare module '@lingui/core/macro' {
  export function t(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): LocalizedString;
  export function t(descriptor: MessageDescriptor): LocalizedString;
}
