import type { GameClientDefinition, GameDefinition } from './game';

/**
 * Lazy-loadable game registration. Composition roots (e.g. `@libs/games`)
 * declare one `GamePlugin` per game; the loaders use dynamic `import()` so
 * each game's code is in its own bundle chunk and only fetched when
 * {@link loadGameDefinitions} / {@link loadGameClientDefinitions} run.
 *
 * The `id` is duplicated here (not just inside the loaded definitions) so
 * the registry can be inspected and validated without resolving any loader.
 */
export type GamePlugin = {
  readonly id: string;
  readonly loadShared: () => Promise<GameDefinition>;
  readonly loadClient: () => Promise<GameClientDefinition>;
};

/** Server / Worker registry entry — no client dynamic imports. */
export type GamePluginShared = Pick<GamePlugin, 'id' | 'loadShared'>;
