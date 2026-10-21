import { ATTR } from './attributes';
import { EVENT } from './events';
import type { NarrateSpan } from './narrate';

/** Span names the person report reads; every other name stays in the trace. */
export const SPAN = {
  CLIENT_ERROR: 'client.error',
  HTTP_REQUEST: 'http.server.request',
  INTERACTION_PREFIX: 'interaction.',
  INTERACTION_TIMING: 'interaction.timing',
  MUTATION_REJECTED: 'mutation.rejected',
  MUTATION_REPLAY: 'mutation.replay',
  ROOM_PREFIX: 'room.websocket.',
  ROUTE_CHANGE: 'route.change',
  RUNTIME_ERROR: 'runtime.error',
} as const;

export function text(span: NarrateSpan, key: string): string | undefined {
  const value = span.attributes[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function count(span: NarrateSpan, key: string): number | undefined {
  const value = span.attributes[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

export function mutationId(span: NarrateSpan): string | undefined {
  return text(span, ATTR.APP_MUTATION_ID);
}

/** Absent on spans recorded before the name was added. */
export function mutationName(span: NarrateSpan): string | undefined {
  return text(span, ATTR.APP_MUTATION_NAME);
}

/** Work against the database: noise in a timeline, counted in a summary. */
export function isDatabase(span: NarrateSpan): boolean {
  return (
    span.attributes[ATTR.DB_SYSTEM_NAME] !== undefined ||
    span.name.startsWith('db.')
  );
}

export function hasException(span: NarrateSpan): boolean {
  return span.events?.some((event) => event.name === 'exception') ?? false;
}

/** An error the person ran into, whatever way the code recorded it. */
export function isProblem(span: NarrateSpan): boolean {
  return (
    span.status === 'error' ||
    span.name === SPAN.CLIENT_ERROR ||
    span.name === SPAN.RUNTIME_ERROR ||
    hasException(span)
  );
}

export function isRejection(span: NarrateSpan): boolean {
  if (span.name === SPAN.MUTATION_REJECTED) return true;
  if (span.name !== SPAN.MUTATION_REPLAY) return false;
  return (
    span.status === 'error' ||
    (span.events?.some((event) => event.name === EVENT.MUTATION_REJECTED) ??
      false)
  );
}

/** Why a span failed, in the words the code recorded. */
export function messageOf(span: NarrateSpan): string {
  if (span.statusMessage !== undefined && span.statusMessage !== '')
    return span.statusMessage;
  const thrown = span.events?.find((event) => event.name === 'exception');
  const fromEvent = thrown?.attributes?.[ATTR.EXCEPTION_MESSAGE];
  if (typeof fromEvent === 'string' && fromEvent !== '') return fromEvent;
  return text(span, ATTR.EXCEPTION_MESSAGE) ?? '';
}

export function oneLine(value: string, max = 160): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`;
}
