/** Kept free of expo and react-native imports so it runs under vitest. */
export type NavRole = 'builder' | 'supplier';

export type TabIcon =
  | 'home'
  | 'search'
  | 'paper-plane'
  | 'clipboard'
  | 'calendar'
  | 'git-branch'
  | 'construct'
  | 'chatbubbles';

export interface TabDef {
  key: string;
  label: string;
  /** Where pressing the tab goes. */
  href: string;
  /** Path whose subtree keeps the tab active. Home has none: it is the fallback. */
  match: string | null;
  icon: TabIcon;
}

export const TABS: Record<NavRole, readonly TabDef[]> = {
  builder: [
    { key: 'home', label: 'Home', href: '/home', match: null, icon: 'home' },
    { key: 'find', label: 'Find', href: '/find', match: '/find', icon: 'search' },
    {
      key: 'requests',
      label: 'Requests',
      href: '/requests',
      match: '/requests',
      icon: 'paper-plane',
    },
    {
      key: 'requirements',
      label: 'Requirements',
      href: '/requirements',
      match: '/requirements',
      icon: 'clipboard',
    },
    {
      key: 'bookings',
      label: 'Bookings',
      href: '/bookings',
      match: '/bookings',
      icon: 'calendar',
    },
  ],
  supplier: [
    { key: 'home', label: 'Home', href: '/supplier', match: null, icon: 'home' },
    {
      key: 'pipeline',
      label: 'Pipeline',
      href: '/supplier/pipeline/tracker',
      match: '/supplier/pipeline',
      icon: 'git-branch',
    },
    {
      key: 'bookings',
      label: 'Bookings',
      href: '/supplier/bookings',
      match: '/supplier/bookings',
      icon: 'calendar',
    },
    {
      key: 'fleet',
      label: 'Fleet',
      href: '/supplier/fleet',
      match: '/supplier/fleet',
      icon: 'construct',
    },
    {
      key: 'assistant',
      label: 'Assistant',
      href: '/supplier/agent',
      match: '/supplier/agent',
      icon: 'chatbubbles',
    },
  ],
};

function segmentsOf(path: string): string[] {
  const bare = path.split(/[?#]/, 1)[0] ?? '';
  return bare.split('/').filter(Boolean);
}

/**
 * The tab that owns `pathname`. Matching is by whole path segment, so
 * `/request/x` does not light Requests; the longest match wins, and any
 * route no tab claims falls back to Home.
 */
export function activeTabFor(role: NavRole, pathname: string): string {
  const path = segmentsOf(pathname);
  let best: { key: string; length: number } | null = null;
  for (const tab of TABS[role]) {
    if (tab.match === null) continue;
    const prefix = segmentsOf(tab.match);
    if (prefix.length > path.length) continue;
    if (!prefix.every((segment, i) => segment === path[i])) continue;
    if (!best || prefix.length > best.length) best = { key: tab.key, length: prefix.length };
  }
  return best?.key ?? 'home';
}
