import { isNamespacedKeyword } from '@gamezilla/lib/keyword';
import { z } from 'zod';

/**
 * Maximum number of patches the wire `/patches/write` endpoint accepts in
 * a single request. Tiger-style contract: clients MUST chunk pushes to fit
 * this bound. Asserted on both ends — the client crashes before sending an
 * over-sized batch (programmer error), and the server validates as a
 * defense-in-depth guard against untrusted inputs.
 */
export const MAX_PATCHES_PER_REQUEST = 1_000;

/** Maximum number of queries the wire `/patches/read` endpoint accepts. */
export const MAX_QUERIES_PER_REQUEST = 1_000;

/**
 * Plain object whose own-enumerable keys are all wire-valid namespaced keywords.
 * Defense-in-depth alongside {@link assertKeywordRecord} at trust boundaries.
 */
export const zKeywordKeyRecord = z
  .record(z.string(), z.unknown())
  .superRefine((rec, ctx) => {
    for (const k of Object.keys(rec)) {
      if (!isNamespacedKeyword(k)) {
        ctx.addIssue({
          code: 'custom',
          message: `invalid keyword key: ${k}`,
          path: [k],
        });
      }
    }
  });

function refinePatchAttributesInRecord(
  rec: Record<string, unknown>,
  ctx: z.RefinementCtx,
  rootPath: (string | number)[]
): void {
  const attrs = rec['attributes'];
  if (
    attrs !== undefined &&
    attrs !== null &&
    typeof attrs === 'object' &&
    !Array.isArray(attrs)
  ) {
    const a = attrs as Record<string, unknown>;
    for (const k of Object.keys(a)) {
      if (!isNamespacedKeyword(k)) {
        ctx.addIssue({
          code: 'custom',
          message: `invalid attribute key: ${k}`,
          path: [...rootPath, 'attributes', k],
        });
      }
    }
  }
}

function refineWhereLeafAttribute(
  o: Record<string, unknown>,
  ctx: z.RefinementCtx,
  path: (string | number)[]
): void {
  const attr = o['attribute'];
  if (typeof attr === 'string' && !isNamespacedKeyword(attr)) {
    ctx.addIssue({
      code: 'custom',
      message: 'where clause attribute must be a namespaced keyword',
      path: [...path, 'attribute'],
    });
  }
}

function refineWhereClauseShape(
  w: unknown,
  ctx: z.RefinementCtx,
  path: (string | number)[]
): void {
  if (w === null || typeof w !== 'object' || Array.isArray(w)) return;
  const o = w as Record<string, unknown>;
  const t = o['type'];
  if (t === 'and' || t === 'or') {
    const clauses = o['clauses'];
    if (Array.isArray(clauses)) {
      for (let i = 0; i < clauses.length; i++) {
        refineWhereClauseShape(clauses[i], ctx, [...path, 'clauses', i]);
      }
    }
    return;
  }
  if (t === 'not') {
    refineWhereClauseShape(o['clause'], ctx, [...path, 'clause']);
    return;
  }
  refineWhereLeafAttribute(o, ctx, path);
}

function refineQueryKeywordFields(
  q: Record<string, unknown>,
  ctx: z.RefinementCtx,
  rootPath: (string | number)[]
): void {
  if (q['where'] !== undefined) {
    refineWhereClauseShape(q['where'], ctx, [...rootPath, 'where']);
  }
  const ob = q['orderBy'];
  if (Array.isArray(ob)) {
    for (let j = 0; j < ob.length; j++) {
      const item = ob[j];
      if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
        const attr = (item as Record<string, unknown>)['attribute'];
        if (typeof attr === 'string' && !isNamespacedKeyword(attr)) {
          ctx.addIssue({
            code: 'custom',
            message: 'orderBy attribute must be a namespaced keyword',
            path: [...rootPath, 'orderBy', j, 'attribute'],
          });
        }
      }
    }
  }
}

/** Wire POST body for `/patches/read` (relative to patch-db base). */
export const patchDbReadBodySchema = z.object({
  queries: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .max(MAX_QUERIES_PER_REQUEST)
    .superRefine((queries, ctx) => {
      for (let i = 0; i < queries.length; i++) {
        refineQueryKeywordFields(queries[i] as Record<string, unknown>, ctx, [
          'queries',
          i,
        ]);
      }
    }),
});

/** Wire POST body for `/patches/write`. */
export const patchDbWriteBodySchema = z.object({
  patches: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .max(MAX_PATCHES_PER_REQUEST)
    .superRefine((patches, ctx) => {
      for (let i = 0; i < patches.length; i++) {
        refinePatchAttributesInRecord(
          patches[i] as Record<string, unknown>,
          ctx,
          ['patches', i]
        );
      }
    }),
});

const patchRejectionReasonSchema = z
  .object({
    patchId: z.string(),
    code: z.string().refine(isNamespacedKeyword, {
      message: 'rejection.code must be a namespaced keyword',
    }),
    reason: z.string(),
    /** Rejected patch body for debugging (omit in minimal / legacy responses). */
    patch: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((rej, ctx) => {
    if (rej.patch !== undefined && rej.patch !== null) {
      refinePatchAttributesInRecord(rej.patch as Record<string, unknown>, ctx, [
        'patch',
      ]);
    }
  });

function refineReadWireResultEntities(
  r: Record<string, unknown>,
  ctx: z.RefinementCtx,
  ri: number
): void {
  const entities = r['entities'];
  if (!Array.isArray(entities)) return;
  for (let ei = 0; ei < entities.length; ei++) {
    const e = entities[ei];
    if (e !== null && typeof e === 'object' && !Array.isArray(e)) {
      refinePatchAttributesInRecord(e as Record<string, unknown>, ctx, [
        'results',
        ri,
        'entities',
        ei,
      ]);
    }
  }
}

function refineReadWireResultPatches(
  r: Record<string, unknown>,
  ctx: z.RefinementCtx,
  ri: number
): void {
  const patches = r['patches'];
  if (!Array.isArray(patches)) return;
  for (let pi = 0; pi < patches.length; pi++) {
    const p = patches[pi];
    if (p !== null && typeof p === 'object' && !Array.isArray(p)) {
      refinePatchAttributesInRecord(p as Record<string, unknown>, ctx, [
        'results',
        ri,
        'patches',
        pi,
      ]);
    }
  }
}

function refineReadWireResultRecord(
  r: Record<string, unknown>,
  ctx: z.RefinementCtx,
  ri: number
): void {
  refineReadWireResultEntities(r, ctx, ri);
  refineReadWireResultPatches(r, ctx, ri);
  if (r['query'] !== undefined && r['query'] !== null) {
    refineQueryKeywordFields(r['query'] as Record<string, unknown>, ctx, [
      'results',
      ri,
      'query',
    ]);
  }
}

/** Successful `/patches/read` response: flat `{ results }`. */
export const patchDbReadWireResponseSchema = z.object({
  results: z
    .array(z.record(z.string(), z.unknown()))
    .superRefine((results, ctx) => {
      for (let ri = 0; ri < results.length; ri++) {
        refineReadWireResultRecord(
          results[ri] as Record<string, unknown>,
          ctx,
          ri
        );
      }
    }),
});

/** Successful `/patches/write` response: flat accepted/rejected. */
export const patchDbWriteWireResponseSchema = z.object({
  accepted: z
    .array(z.record(z.string(), z.unknown()))
    .superRefine((accepted, ctx) => {
      for (let i = 0; i < accepted.length; i++) {
        refinePatchAttributesInRecord(
          accepted[i] as Record<string, unknown>,
          ctx,
          ['accepted', i]
        );
      }
    }),
  rejected: z.array(patchRejectionReasonSchema),
});
