/**
 * Per-item failure surfaced by the indexed NDJSON consumer. Mirrors an
 * {@link NdjsonErrorFrame} but represents the *first* error seen during
 * a stream so the calling transport can map it to a domain-specific
 * exception (auth rejection, server crash, generic failure, etc.).
 */
export class IndexedNdjsonStreamError extends Error {
  readonly status: number;
  readonly index: number;
  readonly kind: string | undefined;
  readonly context: Record<string, unknown> | undefined;

  constructor(args: {
    status: number;
    index: number;
    message: string;
    kind?: string;
    context?: Record<string, unknown>;
  }) {
    super(args.message);
    this.name = 'IndexedNdjsonStreamError';
    this.status = args.status;
    this.index = args.index;
    this.kind = args.kind;
    this.context = args.context;
  }
}
