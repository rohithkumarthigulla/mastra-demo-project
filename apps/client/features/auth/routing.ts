import type { AccountRole } from '@ee/contracts';

export type SupplierProfileState = 'missing' | 'present';

export type SessionSnapshot =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; role: AccountRole; supplierProfile?: SupplierProfileState };

/** Paths only; kept as plain strings so this module runs under vitest without expo-router. */
export type RedirectTarget = '/sign-in' | '/home' | '/supplier' | '/onboarding';

const PUBLIC_ROUTES = new Set(['sign-in', 'register']);

export function homeFor(role: AccountRole): '/home' | '/supplier' | null {
  if (role === 'BUILDER') return '/home';
  if (role === 'SUPPLIER') return '/supplier';
  return null;
}

/**
 * Where the current route should send the user, or null to stay put.
 * `segments` is expo-router's `useSegments()`: groups appear as `(builder)`,
 * and the root index is an empty array.
 */
export function resolveRedirect(
  session: SessionSnapshot,
  segments: readonly string[],
): RedirectTarget | null {
  if (session.status === 'loading') return null;

  const [first] = segments;
  const onPublic = first !== undefined && PUBLIC_ROUTES.has(first);

  if (session.status === 'signedOut') return onPublic ? null : '/sign-in';

  const home = homeFor(session.role);
  // Roles without an area (ADMIN) are signed out by the session provider.
  if (!home) return '/sign-in';

  if (session.role === 'SUPPLIER' && session.supplierProfile === 'missing') {
    return first === 'onboarding' ? null : '/onboarding';
  }

  if (first === undefined || onPublic || first === 'onboarding') return home;

  if (session.role === 'BUILDER' && first === 'supplier') return home;
  if (session.role === 'SUPPLIER' && first === '(builder)') return home;

  return null;
}
