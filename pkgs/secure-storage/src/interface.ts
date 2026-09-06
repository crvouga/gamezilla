/**
 * Key-value storage with async API. Used for deviceId (native: SecureStore, web: localStorage).
 */
export interface SecureStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}
