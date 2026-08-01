export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function asBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 1 || value === '1' || value === 'true') {
    return true;
  }
  if (value === 0 || value === '0' || value === 'false') {
    return false;
  }
  return null;
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function asIsoDate(value: unknown): string | null {
  const text = asString(value);
  if (text === null || text.length === 0) {
    return null;
  }
  const timestamp = Date.parse(text);
  return Number.isNaN(timestamp) ? null : text;
}
