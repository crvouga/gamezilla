/** Gunzip via Streams (Bun / Workers / browsers). */

export async function gunzipBytes(gzipped: Uint8Array): Promise<Uint8Array> {
  const ab = new ArrayBuffer(gzipped.byteLength);
  new Uint8Array(ab).set(gzipped);
  const stream = new Blob([ab])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}
