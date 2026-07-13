import manifest from '../src/manifest.json';
import { ALLOWED_LICENSES } from './curate-mapping';

let failed = false;

for (const entry of manifest) {
  if (
    !ALLOWED_LICENSES.includes(
      entry.license as (typeof ALLOWED_LICENSES)[number]
    )
  ) {
    console.error(`Invalid license for ${entry.id}: ${entry.license}`);
    failed = true;
  }
  if (!entry.sourceUrl.startsWith('https://')) {
    console.error(`Missing source URL for ${entry.id}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Verified licenses for ${manifest.length} sounds.`);
