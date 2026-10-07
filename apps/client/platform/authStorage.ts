import type { AuthStorage } from './types';

// Web: the access token lives only in memory; the refresh token is an httpOnly
// cookie the browser sends to /auth on its own, so JavaScript never sees it.
let accessToken: string | null = null;

export const authStorage: AuthStorage = {
  clientKind: 'web',
  getAccessToken: () => accessToken,
  setAccessToken: (token) => {
    accessToken = token;
  },
  getRefreshToken: async () => null,
  setRefreshToken: async () => {},
  clear: async () => {
    accessToken = null;
  },
};
