import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  ARTIFACT_ORIGIN,
  artifactProtection,
} from '@pkgs/vite-workspace-resolver-server-ts/artifact-protection';
import { build } from 'vite';

// regression: artifact-marker-stripped-by-minification
test('minified builds retain origin, suppress indexing and describe emitted bytes', async () => {
  const result = await build({
    root: fileURLToPath(new URL('./fixtures/protected-build', import.meta.url)),
    configFile: false,
    logLevel: 'silent',
    plugins: [artifactProtection()],
    build: { write: false, minify: true, sourcemap: true },
  });
  if (Array.isArray(result) || !('output' in result))
    throw new Error('Expected one build output');
  const output = result.output;
  const manifest = output.find(
    (file) => file.fileName === 'artifact-provenance.json'
  );
  if (manifest?.type !== 'asset') throw new Error('Missing provenance');
  const provenance = JSON.parse(String(manifest.source)) as {
    origin: string;
    files: { path: string; sha256: string }[];
  };
  expect(provenance.origin).toBe(ARTIFACT_ORIGIN);
  expect(provenance.files.map((file) => file.path)).toEqual(
    output
      .filter((file) => file !== manifest)
      .map((file) => file.fileName)
      .sort()
  );
  for (const entry of provenance.files) {
    const file = output.find((candidate) => candidate.fileName === entry.path);
    if (!file) throw new Error(`Missing artifact: ${entry.path}`);
    const bytes = file.type === 'chunk' ? file.code : file.source;
    expect(entry.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  }
  const chunks = output.filter((file) => file.type === 'chunk');
  expect(chunks.length).toBeGreaterThan(0);
  for (const chunk of chunks) {
    expect(chunk.code).toContain(ARTIFACT_ORIGIN);
    expect(chunk.code).toContain('First-party code: all rights reserved');
    expect(chunk.code).not.toContain('sourceMappingURL');
  }
  expect(output.some((file) => file.fileName.endsWith('.map'))).toBe(false);
  const html = output.find((file) => file.fileName === 'index.html');
  if (html?.type !== 'asset') throw new Error('Missing HTML');
  expect(String(html.source)).toContain('noindex, nofollow, nosnippet');
  expect(String(html.source)).toContain(ARTIFACT_ORIGIN);
});
