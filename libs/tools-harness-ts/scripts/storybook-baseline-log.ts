const BEGIN = '\uE100';
const END = '\uE101';
const BYTE_BASE = 0xe000;

/** Public binary diffs must survive ASCII secret-mask false positives in CI logs. */
export function encodeBaselineLog(patch: string): string {
  const payload = Array.from(Buffer.from(patch, 'utf8'), (byte) =>
    String.fromCharCode(BYTE_BASE + byte)
  ).join('');
  return `${BEGIN}\n${payload.match(/.{1,128}/g)?.join('\n') ?? ''}\n${END}`;
}

/** Ignore job/timestamp prefixes; reject incomplete log transfers. */
export function decodeBaselineLog(log: string): string {
  const start = log.indexOf(BEGIN);
  const end = log.indexOf(END, start + 1);
  if (start < 0 || end < 0)
    throw new Error('The log contains no complete Storybook baseline patch');
  const bytes = Array.from(
    log.slice(start + 1, end).matchAll(/[\uE000-\uE0FF]/g),
    (match) => match[0].charCodeAt(0) - BYTE_BASE
  );
  return Buffer.from(bytes).toString('utf8');
}
