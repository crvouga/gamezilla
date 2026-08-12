// @io-wall-ok — Expo Dev Client wall adapter (composition root only).
import { registerDevMenuItems } from 'expo-dev-client';

import type { DevMenuPort } from './ports';

/** Production {@link DevMenuPort} backed by `expo-dev-client`. */
export function createExpoDevMenuPort(): DevMenuPort {
  return {
    async registerItems(items) {
      await registerDevMenuItems(
        items.map((item) => {
          if (item.shouldCollapse === undefined) {
            return {
              name: item.name,
              callback: item.callback,
            };
          }
          return {
            name: item.name,
            callback: item.callback,
            shouldCollapse: item.shouldCollapse,
          };
        })
      );
    },
  };
}
