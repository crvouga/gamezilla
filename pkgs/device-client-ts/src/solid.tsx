/** @jsxImportSource solid-js */
/** Solid contexts for the device ports that screens read by hook. */

import type { ClipboardPort } from '@pkgs/device-shared-ts/clipboard';
import type { HapticsPort } from '@pkgs/device-shared-ts/haptics';
import { defineContext } from '@pkgs/solid-context-client-ts/define-context';
import type { JSX, ParentProps } from 'solid-js';

const ClipboardContext = defineContext<ClipboardPort>('Clipboard');

export type ClipboardProviderProps = ParentProps<{
  readonly value: ClipboardPort;
}>;

export const ClipboardProvider: (props: ClipboardProviderProps) => JSX.Element =
  ClipboardContext.Provider;

export function useClipboard(): ClipboardPort {
  return ClipboardContext.use();
}

const HapticsContext = defineContext<HapticsPort>('Haptics');

export type HapticsProviderProps = ParentProps<{
  readonly value: HapticsPort;
}>;

export const HapticsProvider: (props: HapticsProviderProps) => JSX.Element =
  HapticsContext.Provider;

/** Injected haptic feedback (vibration on devices, recording in harnesses). */
export function useHaptics(): HapticsPort {
  return HapticsContext.use();
}
