// @io-wall-ok — test double: writes an in-memory artifact's files to a directory.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ArtifactsApi, RunArtifact } from './ci-artifacts';

export interface FakeArtifact {
  readonly runId: string;
  readonly id: number;
  readonly name: string;
  readonly files: Readonly<Record<string, string>>;
  readonly expired?: boolean;
}

/** An in-memory GitHub artifacts API; `removed` records every delete. */
export function fakeArtifactsApi(
  artifacts: readonly FakeArtifact[]
): ArtifactsApi & {
  readonly live: () => readonly FakeArtifact[];
  readonly removed: number[];
} {
  const store = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const removed: number[] = [];
  return {
    removed,
    live: () => [...store.values()],
    list: async (runId) =>
      [...store.values()]
        .filter((artifact) => artifact.runId === runId)
        .map(
          ({ id, name, expired }): RunArtifact => ({
            id,
            name,
            expired: expired ?? false,
          })
        ),
    download: async (id, directory) => {
      const artifact = store.get(id);
      if (!artifact) throw new Error(`No artifact ${String(id)}`);
      for (const [path, content] of Object.entries(artifact.files)) {
        const target = join(directory, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
      }
    },
    remove: async (id) => {
      if (!store.delete(id)) throw new Error(`No artifact ${String(id)}`);
      removed.push(id);
    },
  };
}
