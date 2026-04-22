import type { SecureStorage } from '@gamezilla/shared/secure-storage/interface';
import { Platform } from 'react-native';
import { createExpoSecureStorage } from './secure-storage-expo';
import { createWebSecureStorage } from './secure-storage-web';

/** Platform-specific SecureStorage: SecureStore on native, localStorage on web. */
export function createSecureStorage(): SecureStorage {
  if (Platform.OS === 'web') {
    return createWebSecureStorage();
  }
  return createExpoSecureStorage();
}
