// @io-wall-ok — reads the bundled image files an in-process frame names, for report capture only.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { imageDataUri, localImageType } from './snapshot-local-images';

const dataUris = new Map<string, string>();

/** The bundled image at a `file:` URL as a `data:` URI; throws if it cannot be read. */
export function wallLocalImageDataUri(fileUrl: string): string {
  const known = dataUris.get(fileUrl);
  if (known !== undefined) return known;
  const uri = imageDataUri(
    localImageType(fileUrl),
    readFileSync(fileURLToPath(fileUrl))
  );
  dataUris.set(fileUrl, uri);
  return uri;
}
