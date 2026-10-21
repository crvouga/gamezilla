import { Transform } from 'node:stream';
import { Decompress as ZstdDecompress } from 'fzstd';

export class ZstdDecodeTransform extends Transform {
  private readonly dec: ZstdDecompress;

  constructor() {
    super();
    this.dec = new ZstdDecompress((chunk: Uint8Array) => {
      this.push(Buffer.from(chunk));
    });
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    try {
      this.dec.push(new Uint8Array(chunk));
      callback();
    } catch (e) {
      callback(e instanceof Error ? e : new Error(String(e)));
    }
  }

  override _flush(callback: (error?: Error | null) => void): void {
    try {
      this.dec.push(new Uint8Array(0), true);
      callback();
    } catch (e) {
      callback(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
