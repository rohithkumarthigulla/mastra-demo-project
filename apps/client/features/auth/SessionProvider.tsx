import type { AccountDto, LoginRequest, RegisterRequest } from '@ee/contracts';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, createApiClient, getApiBaseUrl, type ApiClient } from '../../api';
import { authStorage } from '../../platform';
import type { SessionSnapshot, SupplierProfileState } from './routing';

type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut'; notice?: string }
  | { status: 'signedIn'; account: AccountDto; supplierProfile?: SupplierProfileState };

interface SessionContextValue {
  state: SessionState;
  snapshot: SessionSnapshot;
  api: ApiClient;
  signIn: (body: Omit<LoginRequest, 'client'>) => Promise<void>;
  register: (body: Omit<RegisterRequest, 'client'>) => Promise<void>;
  signOut: () => Promise<void>;
  /** Call after the supplier profile has been created. */
  completeOnboarding: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const ADMIN_NOTICE = 'Admin accounts are not supported in this app yet.';

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  // The client outlives renders; route the expiry callback through a ref so it sees fresh state.
  const onExpiredRef = useRef<() => void>(() => {});
  const [api] = useState(() =>
    createApiClient({
      baseUrl: getApiBaseUrl(),
      storage: authStorage,
      onSessionExpired: () => onExpiredRef.current(),
    }),
  );

  onExpiredRef.current = () => {
    queryClient.clear();
    setState({ status: 'signedOut' });
  };

  const establish = useCallback(
    async (account: AccountDto): Promise<SessionState> => {
      if (account.role === 'ADMIN') {
        await api.auth.logout().catch(() => undefined);
        await authStorage.clear();
        return { status: 'signedOut', notice: ADMIN_NOTICE };
      }
      if (account.role !== 'SUPPLIER') return { status: 'signedIn', account };

      try {
        await api.supplierProfile.get();
        return { status: 'signedIn', account, supplierProfile: 'present' };
      } catch (error) {
        if (error instanceof ApiError && error.code === 'supplier_profile_not_found') {
          return { status: 'signedIn', account, supplierProfile: 'missing' };
        }
        throw error;
      }
    },
    [api],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: SessionState = { status: 'signedOut' };
      try {
        // Native without a stored token has nothing to restore; skip the round trip.
        const canRestore =
          authStorage.clientKind === 'web' || (await authStorage.getRefreshToken()) !== null;
        if (canRestore) {
          const { account } = await api.auth.refresh();
          next = await establish(account);
        }
      } catch {
        // A rejected token is cleared by the client; a network failure just leaves us signed out.
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [api, establish]);

  const signIn = useCallback<SessionContextValue['signIn']>(
    async (body) => {
      const { account } = await api.auth.login(body);
      setState(await establish(account));
    },
    [api, establish],
  );

  const register = useCallback<SessionContextValue['register']>(
    async (body) => {
      const { account } = await api.auth.register(body);
      setState(await establish(account));
    },
    [api, establish],
  );

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Signing out locally must succeed even if the server is unreachable.
    }
    await authStorage.clear();
    queryClient.clear();
    setState({ status: 'signedOut' });
  }, [api, queryClient]);

  const completeOnboarding = useCallback(() => {
    setState((prev) =>
      prev.status === 'signedIn' ? { ...prev, supplierProfile: 'present' } : prev,
    );
  }, []);

  const value = useMemo<SessionContextValue>(() => {
    const snapshot: SessionSnapshot =
      state.status === 'signedIn'
        ? { status: 'signedIn', role: state.account.role, supplierProfile: state.supplierProfile }
        : { status: state.status };
    return { state, snapshot, api, signIn, register, signOut, completeOnboarding };
  }, [state, api, signIn, register, signOut, completeOnboarding]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
