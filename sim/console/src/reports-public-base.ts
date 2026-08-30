import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { reportsPublicBaseUrlFromHost } from './reports-public-base-core';

export function reportsPublicBaseUrl(): string {
  return reportsPublicBaseUrlFromHost({
    platformOs: Platform.OS,
    hostUri: Constants.expoConfig?.hostUri,
  });
}
