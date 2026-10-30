// ../../pkgs/clock-shared/src/wall.ts
var wallTimers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle);
  },
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (handle) => {
    globalThis.clearInterval(handle);
  },
};

// ../../pkgs/sql-client-sqlite-web-client/src/spawn-sqlite-worker.ts
var DEFAULT_SQLITE_WORKER_URL = '/sql-workers/sqlite-worker.js';
function spawnSqliteWorker(dbName, workerUrl = DEFAULT_SQLITE_WORKER_URL) {
  return new Worker(workerUrl, {
    type: 'module',
    name: `sqlite:${dbName}`,
  });
}

// ../../pkgs/sql-client-sqlite-web-shared/src/open-retry.ts
var OPEN_DATABASE_TIMEOUT_MS = 25e3;
async function withOpenTimeout(databaseName, promise, timers) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = timers.setTimeout(() => {
      reject(
        new Error(
          `Timed out opening SQLite database "${databaseName}" after ${OPEN_DATABASE_TIMEOUT_MS}ms`
        )
      );
    }, OPEN_DATABASE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== void 0) timers.clearTimeout(timeoutId);
  }
}

// ../../pkgs/sql-client-sqlite-web-shared/src/protocol.ts
function isSqliteWorkerResponse(value) {
  if (value === null || typeof value !== 'object') return false;
  const v = value;
  return typeof v.id === 'string' && typeof v.ok === 'boolean';
}

// ../../pkgs/sql-client-sqlite-web-shared/src/rpc.ts
function serializeSql(query) {
  return {
    sql: query.sql,
    values: [...query.values],
  };
}
function rehydrateError(serialized) {
  const error = new Error(serialized.message);
  error.name = serialized.name;
  if (serialized.stack !== void 0) {
    error.stack = serialized.stack;
  }
  if (serialized.code !== void 0) {
    error.code = serialized.code;
  }
  return error;
}
function createRpcIdFactory(prefix = 'rpc') {
  let n = 0;
  return () => `${prefix}_${++n}`;
}

// ../../pkgs/sql-client-sqlite-web-shared/src/sqlite-worker-client.ts
function createSqliteWorkerRpc(port) {
  const pending = /* @__PURE__ */ new Map();
  const nextId = createRpcIdFactory('sqlw');
  port.onmessage = (event) => {
    const data = event.data;
    if (!isSqliteWorkerResponse(data)) return;
    const entry = pending.get(data.id);
    if (entry === void 0) return;
    pending.delete(data.id);
    if (data.ok) {
      entry.resolve(data.result);
    } else {
      entry.reject(rehydrateError(data.error));
    }
  };
  return {
    request: (op, args) =>
      new Promise((resolve, reject) => {
        const id = nextId();
        pending.set(id, {
          resolve,
          reject,
        });
        const request = { id, op, args };
        port.postMessage(request);
      }),
    abortAll: (reason) => {
      for (const [, entry] of pending) entry.reject(reason);
      pending.clear();
    },
  };
}
function toRunResult(result) {
  return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
}
function createSqliteWorkerSqlClient(args) {
  const { rpc } = args;
  const client = {
    connect: () => Promise.resolve(),
    disconnect: () => args.onDisconnect(),
    query: (query) => rpc.request('query', serializeSql(query)),
    run: async (query) =>
      toRunResult(await rpc.request('run', serializeSql(query))),
    prepare: (query) => ({
      query: (params) =>
        rpc.request('query', {
          sql: query.sql,
          values: params ?? query.values,
        }),
      run: async (params) =>
        toRunResult(
          await rpc.request('run', {
            sql: query.sql,
            values: params ?? query.values,
          })
        ),
    }),
    transaction: async (fn) => {
      await rpc.request('run', { sql: 'BEGIN', values: [] });
      try {
        const result = await fn(client);
        await rpc.request('run', { sql: 'COMMIT', values: [] });
        return result;
      } catch (error) {
        try {
          await rpc.request('run', { sql: 'ROLLBACK', values: [] });
        } catch {}
        throw error;
      }
    },
    exportDatabaseBytesAsync: () => rpc.request('exportBytes', {}),
    importDatabaseBytesAsync: async (bytes) => {
      await rpc.request('importBytes', { bytes });
    },
  };
  return client;
}

// ../../pkgs/sql-client-sqlite-web-shared/src/worker-script-load-error.ts
function workerScriptLoadError(event) {
  const raw2 = (event.message ?? '').trim();
  const hint =
    'SQLite worker failed to load \u2014 cached HTML was served instead of JavaScript (stale deploy or site data). Reload the app or clear site data.';
  return new Error(raw2.length > 0 ? `${hint} (${raw2})` : hint);
}

// ../../pkgs/sql-client-sqlite-web-shared/src/sqlite-worker-sql-owner.ts
var SqliteWorkerSqlOwnerImpl = class {
  constructor(dbName, spawnWorker, timers) {
    this.dbName = dbName;
    this.spawnWorker = spawnWorker;
    this.timers = timers;
  }
  dbName;
  spawnWorker;
  timers;
  live = null;
  openInfo = null;
  spawn() {
    const handle = this.spawnWorker(this.dbName);
    const rpc = createSqliteWorkerRpc(handle);
    const live = { handle, rpc };
    handle.onerror = (event) => {
      rpc.abortAll(workerScriptLoadError(event));
    };
    return live;
  }
  terminate(live) {
    live.handle.onmessage = null;
    live.handle.onerror = null;
    live.handle.terminate();
    live.rpc.abortAll(new Error('SQLite worker terminated'));
  }
  async open() {
    await this.close();
    const live = this.spawn();
    this.live = live;
    try {
      this.openInfo = await withOpenTimeout(
        this.dbName,
        live.rpc.request('open', { dbName: this.dbName }),
        this.timers
      );
    } catch (error) {
      this.live = null;
      this.terminate(live);
      throw error;
    }
    return createSqliteWorkerSqlClient({
      rpc: live.rpc,
      onDisconnect: () => this.close(),
    });
  }
  async close() {
    const live = this.live;
    if (live === null) return;
    this.live = null;
    this.openInfo = null;
    let timeout;
    try {
      await Promise.race([
        live.rpc.request('close', {}),
        new Promise((resolve) => {
          timeout = this.timers.setTimeout(resolve, 1e3);
        }),
      ]);
    } catch {}
    this.timers.clearTimeout(timeout);
    this.terminate(live);
  }
  release() {
    const live = this.live;
    if (live === null) return;
    this.live = null;
    this.openInfo = null;
    this.terminate(live);
  }
  async resetStore() {
    await this.close();
    const live = this.spawn();
    try {
      await withOpenTimeout(
        this.dbName,
        live.rpc.request('resetStore', { dbName: this.dbName }),
        this.timers
      );
    } finally {
      this.terminate(live);
    }
  }
  getOpenInfo() {
    return this.openInfo;
  }
};
function createSqliteWorkerSqlOwner(args) {
  return new SqliteWorkerSqlOwnerImpl(
    args.dbName,
    args.spawnWorker,
    args.timers
  );
}

// ../../pkgs/assert-root-shared/src/crash-handler-default.ts
var UNCATCHABLE_ERROR = { __assertion_failure: true };
var FallbackCrashHandler = class {
  priority = Number.MAX_SAFE_INTEGER;
  match() {
    return true;
  }
  crash(message, context) {
    const { stack } = new Error(message);
    throw { ...UNCATCHABLE_ERROR, message, context, stack };
  }
};

// ../../pkgs/assert-root-shared/src/crash.ts
var handlers = [];
function registerCrashHandler(handler) {
  handlers.push(handler);
  handlers.sort((a, b) => a.priority - b.priority);
  return () => {
    const i = handlers.indexOf(handler);
    if (i >= 0) handlers.splice(i, 1);
  };
}
function dispatchCrash(message, context) {
  for (const h of handlers) {
    if (h.match()) {
      h.crash(message, context);
      return;
    }
  }
  new FallbackCrashHandler().crash(message, context);
}
function crash(condition, message, context) {
  if (condition) return;
  dispatchCrash(message, context);
}

// ../../pkgs/assert-root-shared/src/validation-error.ts
var ValidationError = class extends Error {
  context = {};
  constructor(message, context) {
    super(message);
    this.name = 'ValidationError';
    this.context = context ?? {};
  }
};

// ../../pkgs/assert-root-shared/src/assert.ts
var Assert = class _Assert {
  constructor(errorMode = 'crash') {
    this.errorMode = errorMode;
  }
  errorMode;
  /**
   * Returns an assert instance that throws {@link ValidationError} on failure (for recoverable input checks).
   */
  static validation() {
    return new _Assert('validation');
  }
  /**
   * Returns an assert instance that uses the global crash path on failure (non-recoverable invariant violations).
   */
  static crash() {
    return new _Assert('crash');
  }
  /**
   * Returns an assert instance whose methods are runtime no-ops. Type-level
   * narrowing (`asserts value is T`) still applies, so downstream callers
   * compile as if the check ran. Use only on hot paths via
   * `@pkgs/assert-root-shared` `hotAssert()` — never trust input you did not
   * produce.
   */
  static noop() {
    return new _Assert('noop');
  }
  static withErrorMode(errorMode) {
    return new _Assert(errorMode);
  }
  /**
   * Installs a {@link CrashHandler} for {@link Assert.crash} failures. Handlers are ordered by
   * {@link CrashHandler.priority} (lower first); the first matching handler wins.
   *
   * @returns Disposer that removes this handler.
   */
  static registerCrashHandler(handler) {
    return registerCrashHandler(handler);
  }
  /**
   * @see Assert.registerCrashHandler
   */
  registerCrashHandler(handler) {
    return _Assert.registerCrashHandler(handler);
  }
  /**
   * `true` when this instance runs runtime checks; `false` when it's a noop
   * (so callers can short-circuit expensive validation loops before iterating).
   */
  isEnabled() {
    return this.errorMode !== 'noop';
  }
  /**
   * Asserts that `condition` is true.
   *
   * @param condition - Predicate that must hold.
   * @param message - Message when the assertion fails.
   * @param context - Optional structured context attached to the failure.
   */
  ok(condition, message, context) {
    switch (this.errorMode) {
      case 'noop': {
        return;
      }
      case 'validation': {
        if (!condition) {
          throw new ValidationError(message, context);
        }
        return;
      }
      default: {
        crash(condition, message, context);
      }
    }
  }
  /**
   * Indicates unreachable code. Always fails the assertion.
   *
   * @param message - Message to describe why this code path is unreachable.
   * @param context - Optional structured context attached to the failure.
   * @throws ValidationError if in validation mode.
   * @throws Error (crashes) if in crash mode.
   */
  fail(message, context) {
    this.ok(false, message, context);
  }
  /**
   * Asserts that `value` is one of the strings in `values`.
   *
   * @param value - Value to check.
   * @param values - Allowed string literals.
   * @param message - Message when the assertion fails.
   */
  enum(value, values, message) {
    this.string(value, message);
    for (const v of values) {
      if (v === value) return;
    }
    this.ok(false, message, { value, values });
  }
  /**
   * Asserts that `value` is an array (`Array.isArray`).
   *
   * @param value - Value to check.
   * @param message - Message when the assertion fails.
   * @param context - Optional extra context (merged with `value`).
   */
  array(value, message, context) {
    this.ok(Array.isArray(value), message, { ...context, value });
  }
  /**
   * Asserts that `value` is a non-empty array.
   *
   * @param value - Value to check.
   * @param message - Message when the assertion fails.
   * @param context - Optional extra context (merged with `value`).
   */
  nonEmptyArray(value, message, context) {
    this.array(value, message);
    this.ok(value.length > 0, message, { ...context, value });
  }
  /**
   * Asserts that `value` is neither `null` nor `undefined`.
   *
   * @param value - Possibly nullish value.
   * @param message - Message when the assertion fails.
   * @param context - Optional extra context (merged with `value`).
   */
  defined(value, message, context) {
    this.ok(value !== void 0 && value !== null, message, {
      ...context,
      value,
    });
  }
  /**
   * Asserts strict equality (`===`) between `actual` and `expected`.
   *
   * @param actual - Observed value.
   * @param expected - Expected value.
   * @param message - Message when the assertion fails.
   * @param context - Optional extra context (merged with `actual` and `expected`).
   */
  equals(actual, expected, message, context) {
    this.ok(actual === expected, message, { ...context, actual, expected });
  }
  /**
   * Asserts that `value` has an own or inherited property `field` (`field in value`).
   *
   * @param value - Object to inspect.
   * @param field - Property key that must be present.
   * @param message - Message when the assertion fails.
   */
  field(value, field, message) {
    this.ok(field in value, message, { value, field });
  }
  /**
   * Asserts that `value` is an instance of `ctor`.
   *
   * @param value - Value to check.
   * @param ctor - Constructor function.
   * @param message - Message when the assertion fails.
   */
  instanceOf(value, ctor, message) {
    this.ok(value instanceof ctor, message, { value, ctor: ctor.name });
  }
  /**
   * Asserts that `value` is a non-null object and not an array.
   *
   * @param value - Value to check.
   * @param message - Message when the assertion fails.
   */
  record(value, message, context) {
    this.ok(
      value !== null && typeof value === 'object' && !Array.isArray(value),
      message,
      { ...context, value }
    );
  }
  /**
   * Asserts that `value` has runtime type `string`.
   *
   * @param value - Value to check.
   * @param message - Message when the assertion fails.
   */
  string(value, message, context) {
    this.ok(typeof value === 'string', message, { ...context, value });
  }
  /**
   * Asserts that `value` is a non-empty string.
   *
   * @param value - Value to check.
   * @param message - Message when the assertion fails.
   */
  nonEmptyString(value, message, context) {
    this.string(value, message, context);
    this.ok(value.length > 0, message, { ...context, value });
  }
  /**
   * Asserts that `value` is a finite number (not NaN, not ±Infinity).
   *
   * @param value - Value to check.
   * @param message - Message when the assertion fails.
   */
  number(value, message) {
    this.ok(typeof value === 'number', message, {
      value,
      type: typeof value,
    });
    this.ok(Number.isFinite(value), message, {
      value,
      isFinite: Number.isFinite(value),
    });
    this.ok(!Number.isNaN(value), message, {
      value,
      isNaN: Number.isNaN(value),
    });
  }
  /**
   * Asserts that `value` is a safe integer within `Number.MIN_SAFE_INTEGER`…`Number.MAX_SAFE_INTEGER`.
   *
   * @param value - Value to check.
   * @param message - Message when the assertion fails.
   */
  integer(value, message) {
    this.number(value, message);
    this.ok(
      value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER,
      message,
      {
        value,
        min: Number.MIN_SAFE_INTEGER,
        max: Number.MAX_SAFE_INTEGER,
      }
    );
    this.ok(Number.isSafeInteger(value), message, {
      value,
      isSafeInteger: Number.isSafeInteger(value),
    });
  }
  /**
   * Asserts that `value` is a non-negative number (i.e., `value >= 0`).
   *
   * @param value - Value to check.
   * @param message - Message when the assertion fails.
   */
  nonNegative(value, message) {
    this.number(value, message);
    this.ok(value >= 0, message, {
      value,
      isNonNegative: value >= 0,
    });
  }
  /**
   * Asserts that `value` is a non-negative integer (i.e., a safe integer >= 0).
   *
   * @param value - Value to check.
   * @param message - Message when the assertion fails.
   */
  nonNegativeInteger(value, message) {
    this.integer(value, message);
    this.nonNegative(value, message);
  }
  /**
   * Asserts that `fn` completes without throwing.
   *
   * @param fn - Function to invoke.
   * @param message - Message when `fn` throws.
   * @param context - Optional extra context (the caught `error` is merged in on failure).
   */
  notThrows(fn, message, context) {
    if (!this.isEnabled()) return;
    try {
      fn();
      return;
    } catch (error) {
      this.ok(false, message, { ...context, error });
    }
  }
  /**
   * Asserts that `values` is an array and runs `fn` as a per-element assertion (narrows the element type).
   *
   * @param values - Array to check and iterate.
   * @param fn - Assertion callback invoked for each element.
   */
  all(values, fn) {
    if (!this.isEnabled()) return;
    this.array(values, 'values must be an array');
    for (const value of values) {
      fn(value);
    }
  }
  // biome-ignore lint/suspicious/noExplicitAny: generic higher-order wrapper; parameters/return tied via Parameters<> / ReturnType<>
  fn(checks, message, context) {
    if (!this.isEnabled()) return checks.fn;
    return (...args) => {
      if (checks.pre) {
        this.notThrows(
          () => checks.pre?.(...args),
          message ?? 'Pre-check failed',
          context
        );
      }
      try {
        const returnValue = checks.fn(...args);
        if (checks.post) {
          this.notThrows(
            () => checks.post?.(returnValue),
            message ?? 'Post-check failed',
            context
          );
        }
        return returnValue;
      } catch (error) {
        this.ok(false, message ?? 'Function failed', { ...context, error });
      }
    };
  }
};

// ../../pkgs/assert-root-shared/src/singleton.ts
var assert = Assert.crash();

// ../../pkgs/sql-root-shared/src/sql.ts
var MAX_BOUND_VALUES = 32766;
assert.ok(
  MAX_BOUND_VALUES >= 1,
  'MAX_BOUND_VALUES must allow at least one bound value'
);
function assertNoSqlStatementBoundary(text, label) {
  assert.ok(
    !text.includes(';'),
    `Sql: ${label} forbids semicolons (statement boundary)`,
    { text }
  );
  assert.ok(!text.includes('--'), `Sql: ${label} forbids line comments`, {
    text,
  });
  assert.ok(!text.includes('/*'), `Sql: ${label} forbids block comments`, {
    text,
  });
}
function assertIndexInBounds(index, length, label) {
  assert.ok(index >= 0, `Sql: negative index (${label})`, { index, length });
  assert.ok(index < length, `Sql: index out of bounds (${label})`, {
    index,
    length,
  });
}
function atString(arr, index, label) {
  assertIndexInBounds(index, arr.length, label);
  return arr[index];
}
function atValue(arr, index, label) {
  assertIndexInBounds(index, arr.length, label);
  return arr[index];
}
function atRawValue(arr, index, label) {
  assertIndexInBounds(index, arr.length, label);
  return arr[index];
}
function countFlattenedValues(rawValues) {
  let len = 0;
  for (const value of rawValues) {
    if (value instanceof Sql) {
      len += value.values.length;
    } else {
      len += 1;
    }
  }
  assert.ok(len >= 0, 'Sql: flattened value count must be non-negative', {
    len,
  });
  assert.ok(
    len <= MAX_BOUND_VALUES,
    'Sql: flattened value count exceeds MAX_BOUND_VALUES',
    { len, max: MAX_BOUND_VALUES }
  );
  return len;
}
function appendNestedSql(result, pos, child, rawString) {
  assert.ok(pos < result.strings.length, 'Sql: nest write past strings end', {
    pos,
    stringsLength: result.strings.length,
  });
  assert.equals(
    child.strings.length,
    child.values.length + 1,
    'Sql: nested fragment strings/values invariant broken',
    { stringsLength: child.strings.length, valuesLength: child.values.length }
  );
  result.strings[pos] =
    atString(result.strings, pos, 'nest-prefix') +
    atString(child.strings, 0, 'child-prefix');
  let childIndex = 0;
  while (childIndex < child.values.length) {
    result.values[pos++] = atValue(child.values, childIndex++, 'child-value');
    result.strings[pos] = atString(child.strings, childIndex, 'child-string');
  }
  result.strings[pos] =
    atString(result.strings, pos, 'nest-suffix') + rawString;
  return pos;
}
function assertStringsValuesPair(strings, values, label) {
  assert.ok(strings.length >= 1, `Sql: ${label} needs at least one string`, {
    stringsLength: strings.length,
  });
  assert.equals(
    strings.length,
    values.length + 1,
    `Sql: ${label} strings/values length mismatch`,
    { stringsLength: strings.length, valuesLength: values.length }
  );
}
function flattenSql(rawStrings, rawValues) {
  assert.ok(rawStrings.length >= 1, 'Sql: expected at least 1 string', {
    rawStringsLength: rawStrings.length,
    rawValuesLength: rawValues.length,
  });
  assert.equals(
    rawStrings.length,
    rawValues.length + 1,
    `Sql: expected ${rawStrings.length} strings to have ${rawStrings.length - 1} values`,
    {
      rawStringsLength: rawStrings.length,
      rawValuesLength: rawValues.length,
    }
  );
  const valuesLength = countFlattenedValues(rawValues);
  const values = new Array(valuesLength);
  const strings = new Array(valuesLength + 1);
  strings[0] = atString(rawStrings, 0, 'raw-prefix');
  let i = 0;
  let pos = 0;
  const result = { strings, values };
  while (i < rawValues.length) {
    const child = atRawValue(rawValues, i++, 'raw-value');
    const rawString = atString(rawStrings, i, 'raw-string');
    if (child instanceof Sql) {
      pos = appendNestedSql(result, pos, child, rawString);
    } else {
      values[pos++] = child;
      strings[pos] = rawString;
    }
  }
  assertStringsValuesPair(strings, values, 'flattened');
  return { strings, values };
}
function joinPlaceholders(strings, format) {
  assert.ok(strings.length >= 1, 'Sql: joinPlaceholders needs strings', {
    stringsLength: strings.length,
  });
  const len = strings.length;
  let i = 1;
  let value = atString(strings, 0, 'placeholder-prefix');
  while (i < len) {
    value += `${format(i)}${atString(strings, i, 'placeholder-part')}`;
    i++;
  }
  return value;
}
var Sql = class {
  /**
   * Phantom row type — never read at runtime; preserves `T` so `Sql<A>` is not
   * assignable to `Sql<B>`. Use `!` (not `declare`): the Flow strip-types
   * plugin rejects `declare` class fields.
   */
  $row;
  values;
  strings;
  constructor(rawStrings, rawValues) {
    const flattened = flattenSql(rawStrings, rawValues);
    assertStringsValuesPair(flattened.strings, flattened.values, 'constructed');
    this.values = Object.freeze(flattened.values);
    this.strings = Object.freeze(flattened.strings);
  }
  get sql() {
    return joinPlaceholders(this.strings, () => '?');
  }
  get statement() {
    return joinPlaceholders(this.strings, (i) => `:${i}`);
  }
  get text() {
    return joinPlaceholders(this.strings, (i) => `$${i}`);
  }
  inspect() {
    return {
      sql: this.sql,
      statement: this.statement,
      text: this.text,
      values: this.values,
    };
  }
  [/* @__PURE__ */ Symbol.for('nodejs.util.inspect.custom')]() {
    return this.inspect();
  }
};
function raw(value) {
  assert.string(value, 'Sql: raw() expects a string', { value });
  assertNoSqlStatementBoundary(value, 'raw()');
  return new Sql([value], []);
}
var empty = raw('');
assert.equals(empty.values.length, 0, 'empty must bind no values', {
  valuesLength: empty.values.length,
});
assert.equals(empty.strings.length, 1, 'empty must be a single string', {
  stringsLength: empty.strings.length,
});
assert.equals(empty.strings[0], '', 'empty string must be ""', {
  strings: empty.strings,
});

// ../../pkgs/sql-client-sqlite-web-client/src/sql-host-entry.ts
function makeSql(statement, values) {
  return new Sql(statement.split('?'), values);
}
function createSqlHost() {
  let owner = null;
  let client = null;
  const requireClient = () => {
    if (client === null) throw new Error('sql-host: open() was not called');
    return client;
  };
  const close = async () => {
    const live = owner;
    client = null;
    owner = null;
    if (live === null) return;
    await live.close();
  };
  return {
    open: async (dbName) => {
      await close();
      const next = createSqliteWorkerSqlOwner({
        dbName,
        timers: wallTimers,
        spawnWorker: (name) => spawnSqliteWorker(name),
      });
      owner = next;
      client = await next.open();
    },
    close,
    query: (sql, values = []) => requireClient().query(makeSql(sql, values)),
    run: async (sql, values = []) => {
      const result = await requireClient().run(makeSql(sql, values));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: result.changes,
      };
    },
    resetStore: async () => {
      const live = owner;
      client = null;
      owner = null;
      if (live === null) return;
      await live.resetStore();
    },
  };
}
globalThis.__sqlHost = createSqlHost();
window.parent.postMessage({ type: 'ready', source: 'sql-host' }, '*');
