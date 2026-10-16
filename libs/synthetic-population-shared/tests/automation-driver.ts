import { expect } from 'bun:test';
import type { Driver, DriverNode } from '@pkgs/ui-testing-root-shared/driver';

/** An ordinary control surface; unknown gestures fail rather than pretending to act. */
export function automationDriver(input: {
  visible: Set<string>;
  attributes?: Map<string, string>;
  texts?: Map<string, string>;
  onTap?: (id: string) => void;
}) {
  const actions: string[] = [];
  const unsupported = async (): Promise<never> => {
    throw new Error('Unexpected driver operation');
  };
  function node(id: string): DriverNode {
    return {
      get: node,
      attribute: async (name) => input.attributes?.get(`${id}:${name}`) ?? null,
      isVisible: async () => input.visible.has(id),
      text: async () => input.texts?.get(id) ?? null,
      tap: async () => {
        expect(input.visible.has(id)).toBe(true);
        actions.push(id);
        input.onTap?.(id);
      },
      key: async (key) => {
        actions.push(`${id}:${key}`);
      },
      wait: async (state) => {
        expect(input.visible.has(id)).toBe(state === 'visible');
      },
      expect: {
        visible: async () => {
          expect(input.visible.has(id)).toBe(true);
        },
        hidden: async () => {
          expect(input.visible.has(id)).toBe(false);
        },
        text: async (text) => {
          expect(input.texts?.get(id)).toBe(text);
        },
      },
      tapAt: unsupported,
      drag: unsupported,
      layout: unsupported,
      input: unsupported,
      selectFile: unsupported,
      clear: unsupported,
      scroll: unsupported,
    };
  }
  const driver: Driver = {
    kind: 'automation-contract',
    get: node,
    launch: unsupported,
    close: unsupported,
    key: unsupported,
    snapshotHtml: async () => null,
  };
  return { driver, actions };
}
