const LIMIT = 256;

/** Cache parsed statements per connection, never their bound values or results. */
export function createStatementCache<Connection extends object, Statement>(
  prepare: (connection: Connection, text: string) => Statement
): (connection: Connection, text: string) => Statement {
  const connections = new WeakMap<Connection, Map<string, Statement>>();
  return (connection, text) => {
    let statements = connections.get(connection);
    if (statements === undefined) {
      statements = new Map();
      connections.set(connection, statements);
    }
    const cached = statements.get(text);
    if (cached !== undefined) {
      statements.delete(text);
      statements.set(text, cached);
      return cached;
    }
    const statement = prepare(connection, text);
    if (statements.size >= LIMIT) {
      const oldest = statements.keys().next().value;
      if (oldest !== undefined) statements.delete(oldest);
    }
    statements.set(text, statement);
    return statement;
  };
}
