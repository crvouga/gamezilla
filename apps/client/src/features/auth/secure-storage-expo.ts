import { wrapSecureStorage } from '@gamezilla/lib/secure-storage';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import * as SecureStore from 'expo-secure-store';

export function createExpoSecureStorage(): SecureStorage {
  return wrapSecureStorage({
    async getItem(key: string): Promise<string | null> {
      return SecureStore.getItemAsync(key);
    },
    async setItem(key: string, value: string): Promise<void> {
      await SecureStore.setItemAsync(key, value);
    },
    async deleteItem(key: string): Promise<void> {
      await SecureStore.deleteItemAsync(key);
    },
  });
}
