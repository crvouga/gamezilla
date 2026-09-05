/**
 * `createNodeMock` for react-test-renderer: gives host refs (`View`, `Text`,
 * …) the imperative surface RN code reaches for. Without it refs are `null`,
 * so anchored popovers (`measureInWindow` → open) never open under test.
 * Measurements report a zero rect; layout-driven positioning is not under
 * test here, only that the callback fires.
 */

import type {
  MeasureInWindowOnSuccessCallback,
  MeasureLayoutOnSuccessCallback,
  MeasureOnSuccessCallback,
} from 'react-native';

export type HostNodeMock = {
  measure(callback: MeasureOnSuccessCallback): void;
  measureInWindow(callback: MeasureInWindowOnSuccessCallback): void;
  measureLayout(
    relativeToNativeNode: unknown,
    onSuccess: MeasureLayoutOnSuccessCallback
  ): void;
  setNativeProps(): void;
  focus(): void;
  blur(): void;
};

export function createHostNodeMock(): HostNodeMock {
  return {
    measure: (callback) => {
      callback(0, 0, 0, 0, 0, 0);
    },
    measureInWindow: (callback) => {
      callback(0, 0, 0, 0);
    },
    measureLayout: (_relativeTo, onSuccess) => {
      onSuccess(0, 0, 0, 0);
    },
    setNativeProps: () => undefined,
    focus: () => undefined,
    blur: () => undefined,
  };
}

/** Pass as `render(element, { createNodeMock })`. */
export const createNodeMock = (): HostNodeMock => createHostNodeMock();
