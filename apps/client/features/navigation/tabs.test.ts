import { describe, expect, it } from 'vitest';
import { TABS, activeTabFor, tabPressAction } from './tabs';

describe('TABS', () => {
  it('lists the builder tabs in order', () => {
    expect(TABS.builder.map((t) => [t.label, t.href])).toEqual([
      ['Home', '/home'],
      ['Find', '/find'],
      ['Requests', '/requests'],
      ['Requirements', '/requirements'],
      ['Bookings', '/bookings'],
    ]);
  });

  it('lists the supplier tabs in order', () => {
    expect(TABS.supplier.map((t) => [t.label, t.href])).toEqual([
      ['Home', '/supplier'],
      ['Pipeline', '/supplier/pipeline/tracker'],
      ['Bookings', '/supplier/bookings'],
      ['Fleet', '/supplier/fleet'],
      ['Assistant', '/supplier/agent'],
    ]);
  });

  it.each(['builder', 'supplier'] as const)('each %s tab href activates its own tab', (role) => {
    for (const tab of TABS[role]) expect(activeTabFor(role, tab.href)).toBe(tab.key);
  });
});

describe('activeTabFor builder', () => {
  it.each([
    ['/home', 'home'],
    ['/', 'home'],
    ['', 'home'],
    ['/find', 'find'],
    ['/requests', 'requests'],
    ['/requests/abc', 'requests'],
    ['/request/listing-1', 'home'],
    ['/requirements', 'requirements'],
    ['/requirements/new', 'requirements'],
    ['/requirements/xyz', 'requirements'],
    ['/bookings', 'bookings'],
    ['/bookings/abc', 'bookings'],
    ['/bookings/abc/', 'bookings'],
    ['/bookings?status=ACTIVE', 'bookings'],
    ['/bookings#top', 'bookings'],
    ['/bookingsx', 'home'],
    ['/quotes/q1', 'home'],
    ['/notifications', 'home'],
    ['/equipment', 'home'],
    ['/supplier/fleet', 'home'],
  ])('%s → %s', (path, tab) => {
    expect(activeTabFor('builder', path)).toBe(tab);
  });
});

describe('activeTabFor supplier', () => {
  it.each([
    ['/supplier', 'home'],
    ['/supplier/', 'home'],
    ['/supplier/pipeline', 'pipeline'],
    ['/supplier/pipeline/tracker', 'pipeline'],
    ['/supplier/pipeline/requests/r1', 'pipeline'],
    ['/supplier/pipeline/quotes/new', 'pipeline'],
    ['/supplier/pipeline/quotes/q1', 'pipeline'],
    ['/supplier/bookings', 'bookings'],
    ['/supplier/bookings/b1', 'bookings'],
    ['/supplier/fleet', 'fleet'],
    ['/supplier/fleet/listings', 'fleet'],
    ['/supplier/fleet/listings/l1', 'fleet'],
    ['/supplier/fleet/units/new', 'fleet'],
    ['/supplier/agent', 'assistant'],
    ['/supplier/quotes', 'home'],
    ['/supplier/availability', 'home'],
    ['/supplier/company', 'home'],
    ['/supplier/notifications', 'home'],
    ['/supplier/fleetx', 'home'],
    ['/bookings', 'home'],
  ])('%s → %s', (path, tab) => {
    expect(activeTabFor('supplier', path)).toBe(tab);
  });
});

describe('tabPressAction', () => {
  const tab = (role: 'builder' | 'supplier', key: string) => {
    const found = TABS[role].find((t) => t.key === key);
    if (!found) throw new Error(`no ${role} tab ${key}`);
    return found;
  };

  it.each(['builder', 'supplier'] as const)('does nothing on each %s tab’s own screen', (role) => {
    for (const t of TABS[role]) expect(tabPressAction(t.href, t)).toBe('none');
  });

  it.each([
    ['builder', '/home', 'requirements'],
    ['builder', '/requirements', 'bookings'],
    ['builder', '/bookings/abc', 'bookings'],
    ['builder', '/requirements/new', 'requirements'],
    ['builder', '/notifications', 'home'],
    ['supplier', '/supplier', 'fleet'],
    ['supplier', '/supplier/fleet/listings/l1', 'fleet'],
    ['supplier', '/supplier/pipeline/requests/r1', 'pipeline'],
    ['supplier', '/supplier/agent', 'home'],
  ] as const)('%s on %s pressing %s resets', (role, path, key) => {
    expect(tabPressAction(path, tab(role, key))).toBe('reset');
  });

  it('ignores trailing slashes, query and hash', () => {
    expect(tabPressAction('/bookings/?status=ACTIVE', tab('builder', 'bookings'))).toBe('none');
    expect(tabPressAction('/supplier/#top', tab('supplier', 'home'))).toBe('none');
  });
});
