/** @jsxImportSource solid-js */
/** Solid contexts for the device ports that screens read by hook. */

import { defineContext } from '@pkgs/solid-context/define-context';
import type { JSX, ParentProps } from 'solid-js';

import type { ClipboardPort } from './clipboard';

const ClipboardContext = defineContext<ClipboardPort>('Clipboard');

export type ClipboardProviderProps = ParentProps<{
  readonly value: ClipboardPort;
}>;

export const ClipboardProvider: (props: ClipboardProviderProps) => JSX.Element =
  ClipboardContext.Provider;

export function useClipboard(): ClipboardPort {
  return ClipboardContext.use();
}
