/**
 * In-process actors render bundled images at the `file:` URL Bun gives a
 * module asset (`new URL('./mark.png', import.meta.url)`), where the product
 * build serves a hashed web asset. A recorded frame must stand on its own:
 * the UI-quality replay and report viewers allow only `data:` images, so a
 * machine-local path in a frame can never be decoded there.
 */

const LOCAL_IMAGE_SOURCE = /(\ssrc=")(file:[^"]*)"/gi;

const IMAGE_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

/** The media type of a bundled image file, by its extension. */
export function localImageType(url: string): string {
  const pathname = new URL(url).pathname;
  const extension = pathname.slice(pathname.lastIndexOf('.') + 1).toLowerCase();
  const type = IMAGE_TYPES[extension];
  if (type === undefined)
    throw new Error(`Snapshot image has no known image type: ${url}`);
  return type;
}

/** A `data:` URI carrying the image bytes with their media type. */
export function imageDataUri(type: string, bytes: Uint8Array): string {
  return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
}

function decodeAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Replace every `src` that names a local file with that file's bytes as a
 * `data:` URI. `read` throws for an unreadable file, so a frame never
 * silently loses an image.
 */
export function inlineLocalImageSources(
  html: string,
  read: (fileUrl: string) => string
): string {
  return html.replace(
    LOCAL_IMAGE_SOURCE,
    (_match, prefix: string, url: string) =>
      `${prefix}${read(decodeAttribute(url))}"`
  );
}
