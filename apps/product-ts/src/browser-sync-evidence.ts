function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Keep sync metadata, never query parameters, row contents or mutation arguments. */
export function syncRequestEvidence(path: string, body: string | undefined) {
  try {
    const value = record(JSON.parse(body ?? '{}'));
    const items = path.endsWith('/query')
      ? value['queries']
      : path.endsWith('/mutations')
        ? value['mutations']
        : [];
    return Array.isArray(items)
      ? items.map((item) => String(record(item)['name'])).slice(0, 64)
      : [];
  } catch {
    return [];
  }
}

function rowCounts(tables: unknown) {
  if (tables === null || typeof tables !== 'object') return {};
  return Object.fromEntries(
    Object.entries(tables).map(([table, rows]) => [
      table,
      Array.isArray(rows)
        ? {
            total: rows.length,
            live: rows.filter((row) => !record(row)['deleted_at']).length,
          }
        : { total: 0, live: 0 },
    ])
  );
}

export function syncResponseEvidence(path: string, body: string) {
  try {
    const value = record(JSON.parse(body));
    const responses = value['responses'];
    if (path.endsWith('/query') && Array.isArray(responses))
      return responses.map((raw) => {
        const response = record(raw);
        return {
          status: response['status'],
          checkpoint: response['checkpoint'],
          tables: rowCounts(response['tables']),
        };
      });
    const verdicts = value['verdicts'];
    if (path.endsWith('/mutations') && Array.isArray(verdicts))
      return {
        verdicts: verdicts.map((verdict) => ({
          status: record(verdict)['status'],
          code: record(verdict)['code'],
        })),
        topics: Object.keys(record(value['topicPushSeqs'])),
      };
  } catch {
    // Non-JSON errors already have their HTTP status in the network log.
  }
  return undefined;
}

function variableInteger(bytes: Uint8Array, offset: number) {
  let value = 0;
  let multiplier = 1;
  for (let n = 0; n < 4 && offset < bytes.length; n++) {
    const digit = bytes[offset++]!;
    value += (digit & 127) * multiplier;
    if (digit < 128) return { value, offset };
    multiplier *= 128;
  }
  return null;
}

/** Decode only received PUBLISH metadata; CONNECT credentials are never inspected. */
export function mqttPushEvidence(payload: string, protocol: number) {
  try {
    const bytes = Buffer.from(payload, 'base64');
    if (bytes[0]! >> 4 !== 3) return undefined;
    const remaining = variableInteger(bytes, 1);
    if (remaining === null) return undefined;
    let offset = remaining.offset;
    const topicLength = (bytes[offset++]! << 8) | bytes[offset++]!;
    const topic = bytes.subarray(offset, offset + topicLength).toString('utf8');
    if (!/^(room|user|account)[:/][a-zA-Z0-9:_/-]+$/.test(topic))
      return undefined;
    offset += topicLength;
    if (((bytes[0]! >> 1) & 3) !== 0) offset += 2;
    if (protocol === 5) {
      const properties = variableInteger(bytes, offset);
      if (properties === null) return undefined;
      offset = properties.offset + properties.value;
    }
    const message = record(JSON.parse(bytes.subarray(offset).toString('utf8')));
    return {
      topic,
      pushSeq: message['pushSeq'],
      checkpoint: message['checkpoint'],
      tables: message['tables'],
      rows: rowCounts(message['rows']),
    };
  } catch {
    return undefined;
  }
}
