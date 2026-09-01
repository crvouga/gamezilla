/**
 * esbuild alias target for `expo` inside the sql-host bundle.
 *
 * Mirrors the three symbols expo-sqlite's web module actually uses
 * (`NativeModule`, `registerWebModule`, `requireNativeModule`) with the same
 * semantics as `expo-modules-core`'s web polyfill, without pulling in the
 * expo runtime.
 */

import { EventEmitter } from './expo-event-emitter';

export { EventEmitter };

export class NativeModule extends EventEmitter {
  [key: string]: unknown;
}

/** Same registry slot the real expo-modules-core web polyfill writes into. */
type ExpoGlobalScope = { expo?: { modules?: Record<string, unknown> } };

function moduleRegistry(): Record<string, unknown> {
  const scope = globalThis as unknown as ExpoGlobalScope;
  scope.expo ??= {};
  scope.expo.modules ??= {};
  return scope.expo.modules;
}

export function registerWebModule<T>(
  moduleImplementation: new () => T,
  moduleName: string
): T {
  const name = moduleName || moduleImplementation.name;
  if (!name) {
    throw new Error('registerWebModule requires a module name');
  }
  const modules = moduleRegistry();
  const existing = modules[name];
  if (existing !== undefined) return existing as T;
  const instance = new moduleImplementation();
  modules[name] = instance;
  return instance;
}

export function requireOptionalNativeModule<T>(moduleName: string): T | null {
  return (moduleRegistry()[moduleName] as T | undefined) ?? null;
}

export function requireNativeModule<T>(moduleName: string): T {
  const found = requireOptionalNativeModule<T>(moduleName);
  if (found !== null) return found;
  throw new Error(`Cannot find native module '${moduleName}'`);
}
