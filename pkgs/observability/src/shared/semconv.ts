export const Semconv = {
  serviceName: 'service.name',
  httpRequestMethod: 'http.request.method',
  httpResponseStatusCode: 'http.response.status_code',
  urlPath: 'url.path',
  dbSystem: 'db.system',
  dbOperation: 'db.operation',
  dbStatement: 'db.statement',
  dbRowCount: 'db.row_count',
  exceptionType: 'exception.type',
  exceptionMessage: 'exception.message',
  httpAttempt: 'http.attempt',
} as const;

export const DB_SYSTEM_POSTGRESQL = 'postgresql';

export function truncateStatement(sql: string, maxLen = 120): string {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen)}…`;
}

export function sqlOperation(sql: string): string {
  const token = sql.trim().split(/\s+/)[0]?.toUpperCase() ?? 'UNKNOWN';
  return token.length > 0 ? token : 'UNKNOWN';
}
