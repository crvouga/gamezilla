import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/** Stable, brand-independent identifier; never a credential or user identifier. */
export const ARTIFACT_ORIGIN = 'urn:uuid:9bd0b75d-0e0c-4e71-9781-0e037a78ef49';
const NOTICE =
  'Copyright (c) 2026 Chris Vouga. First-party code: all rights reserved; third-party licenses apply.';

export function artifactDigest(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Build evidence only: neither a signature nor proof of authorship. */
export function artifactProtection(): Plugin {
  return {
    name: 'artifact-protection',
    apply: 'build',
    enforce: 'post',
    config: () => ({ build: { sourcemap: false } }),
    transformIndexHtml: {
      order: 'post',
      handler: () => [
        {
          tag: 'meta',
          attrs: { name: 'robots', content: 'noindex, nofollow, nosnippet' },
          injectTo: 'head',
        },
        {
          tag: 'meta',
          attrs: { name: 'artifact-origin', content: ARTIFACT_ORIGIN },
          injectTo: 'head',
        },
      ],
    },
    augmentChunkHash: () => `${ARTIFACT_ORIGIN};${NOTICE};marker-v1`,
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const files = Object.keys(bundle)
          .sort()
          .map((path) => {
            const output = bundle[path];
            if (!output) throw new Error(`Missing build output: ${path}`);
            if (output.type === 'chunk') {
              const digest = artifactDigest(output.code);
              output.code = `/*! Origin: ${ARTIFACT_ORIGIN}; content-sha256: ${digest}. ${NOTICE} */\n${output.code}`;
            }
            const content =
              output.type === 'chunk' ? output.code : output.source;
            return { path, sha256: artifactDigest(content) };
          });
        this.emitFile({
          type: 'asset',
          fileName: 'artifact-provenance.json',
          source: `${JSON.stringify(
            {
              schemaVersion: 1,
              origin: ARTIFACT_ORIGIN,
              algorithm: 'sha256',
              scope:
                'Vite output bundle before post-build processing; excludes public directory copies, service worker and this manifest',
              files,
            },
            null,
            2
          )}\n`,
        });
      },
    },
  };
}
