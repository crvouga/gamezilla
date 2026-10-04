// @io-wall-ok — fixture authoring; committed PNGs are the test corpus.

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { DEFECTS, FAMILIES, fixtureSvg } from './fixture-ui';

const samples = [];
for (const variant of [0, 1]) {
  const split = variant === 0 ? 'calibration' : 'evaluation';
  for (const family of FAMILIES) {
    for (const defect of [undefined, ...DEFECTS]) {
      const label = defect ? 'bad' : 'good';
      const name = `${family}${defect ? `-${defect}` : ''}.png`;
      const path = `fixtures/${split}/${label}/${name}`;
      await mkdir(`fixtures/${split}/${label}`, { recursive: true });
      const bytes = await sharp(
        Buffer.from(
          fixtureSvg({ family, variant, ...(defect ? { defect } : {}) })
        )
      )
        .png()
        .toBuffer();
      await writeFile(path, bytes);
      samples.push({
        path,
        split,
        label,
        family,
        defect: defect ?? null,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
}
await writeFile(
  'fixtures/corpus.json',
  `${JSON.stringify({ schemaVersion: 1, origin: 'Synthetic SVG UI with controlled geometric defects; no application assets or private data.', samples }, null, 2)}\n`
);
console.log(`Generated ${samples.length} labeled screenshots.`);
