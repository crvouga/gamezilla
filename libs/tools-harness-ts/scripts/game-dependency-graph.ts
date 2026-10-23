export type GamePackage = {
  readonly name: string;
  readonly game?: string;
  readonly gameRegistry?: boolean;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
};

/** Every shortest path by which a non-composition package reaches a foreign game. */
export function forbiddenGamePaths(
  root: GamePackage,
  workspace: ReadonlyMap<string, GamePackage>
): readonly (readonly string[])[] {
  if (root.gameRegistry === true) return [];
  const paths: string[][] = [];
  const seen = new Set([root.name]);
  const queue: {
    readonly manifest: GamePackage;
    readonly path: readonly string[];
  }[] = [{ manifest: root, path: [root.name] }];
  for (let entry = queue.shift(); entry !== undefined; entry = queue.shift()) {
    const dependencies = {
      ...entry.manifest.dependencies,
      ...entry.manifest.devDependencies,
    };
    for (const dependency of Object.keys(dependencies).sort()) {
      const manifest = workspace.get(dependency);
      if (manifest === undefined || seen.has(dependency)) continue;
      seen.add(dependency);
      const path = [...entry.path, dependency];
      if (
        manifest.gameRegistry === true ||
        (manifest.game !== undefined && manifest.game !== root.game)
      )
        paths.push(path);
      else queue.push({ manifest, path });
    }
  }
  return paths;
}
