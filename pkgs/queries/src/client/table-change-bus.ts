export type TableChangeListener = (tables: ReadonlySet<string>) => void;

/** Post-commit batched table-change notifications. */
export function createTableChangeBus() {
  const listeners = new Set<TableChangeListener>();
  return {
    subscribe(listener: TableChangeListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(tables: readonly string[]): void {
      if (tables.length === 0) return;
      const set = new Set(tables);
      for (const listener of listeners) listener(set);
    },
  };
}

export type TableChangeBus = ReturnType<typeof createTableChangeBus>;
