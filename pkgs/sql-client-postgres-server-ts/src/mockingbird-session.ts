import type { Database } from '@crvouga/mockingbird-service-postgres';

type Session = {
  readonly acquire: () => Promise<() => void>;
  readonly run: <T>(operation: () => Promise<T> | T) => Promise<T>;
};

const sessions = new WeakMap<Database, Session>();

/** Serialize transaction ownership of the engine's one session. Single SQL
 * statements execute synchronously, including callbacks within a transaction. */
export function mockingbirdSession(db: Database): Session {
  const existing = sessions.get(db);
  if (existing !== undefined) return existing;
  let available = Promise.resolve();
  const acquire = async (): Promise<() => void> => {
    const previous = available;
    let release: () => void = () => undefined;
    available = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    return release;
  };
  const session: Session = {
    acquire,
    run: async (operation) => {
      const release = await acquire();
      try {
        return await operation();
      } finally {
        release();
      }
    },
  };
  sessions.set(db, session);
  return session;
}
