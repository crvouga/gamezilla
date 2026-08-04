/**
 * Bun test preload for the in-process driver.
 *
 * 1. Registers happy-dom globals (`document`, `window`, …) before any
 *    Testing Library / React import evaluates.
 * 2. Aliases `react-native` → `react-native-web` via `mock.module` so app
 *    code that imports `react-native` renders in Node without Flow
 *    transpilation. (Bun's bundler `plugin()` onResolve does not apply to
 *    `bun test` module resolution.)
 *
 * Consumers of `@pkgs/ui-testing` should point their own `bunfig.toml`
 * `[test].preload` at this file (or re-export it) when using InProcessDriver.
 */
import { mock } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

void mock.module('react-native', () => import('react-native-web'));
