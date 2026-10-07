import type { ClientKind } from '@ee/contracts';

export interface AuthStorage {
  clientKind: ClientKind;
  getAccessToken(): string | null;
  setAccessToken(token: string | null): void;
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string | null): Promise<void>;
  clear(): Promise<void>;
}
