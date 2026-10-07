import * as SecureStore from 'expo-secure-store';
import type { AuthStorage } from './types';

const REFRESH_TOKEN_KEY = 'ee.refreshToken';

let accessToken: string | null = null;

export const authStorage: AuthStorage = {
  clientKind: 'native',
  getAccessToken: () => accessToken,
  setAccessToken: (token) => {
    accessToken = token;
  },
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  setRefreshToken: async (token) => {
    if (token) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
  clear: async () => {
    accessToken = null;
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
