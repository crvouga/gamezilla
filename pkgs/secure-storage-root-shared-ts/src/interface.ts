/**
 * Key-value storage with async API. Used for deviceId (native: SecureStore, web: localStorage).
 */
export interface SecureStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
  /**
   * Reports each key that another holder of the same storage changed — a
   * second browser tab. Absent where the storage has only one holder.
   */
  subscribe?(listener: (key: string) => void): () => void;
}
