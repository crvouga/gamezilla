import type { TokenCache } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';

/** Clerk session cache — mirrors Clerk Expo quickstart; keeps tokens off plain AsyncStorage. */
export const clerkSecureTokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    await SecureStore.setItemAsync(key, value);
  },
};
