import { ATTR, type Link, linkFromTraceparent } from '@pkgs/observability/core';

/** Link a replay/upload span to the interaction that created an offline mutation. */
export function mutationOriginLink(
  traceparent: string | null,
  createdAt: string,
  mutationId: string
): Link | undefined {
  if (traceparent === null) return undefined;
  const link = linkFromTraceparent(traceparent);
  if (link === undefined) return undefined;
  const originTimeMs = Date.parse(createdAt);
  return {
    ...link,
    attributes: {
      [ATTR.APP_MUTATION_ID]: mutationId,
      ...(Number.isFinite(originTimeMs)
        ? { [ATTR.APP_MUTATION_ORIGIN_TIME_MS]: originTimeMs }
        : {}),
    },
  };
}
