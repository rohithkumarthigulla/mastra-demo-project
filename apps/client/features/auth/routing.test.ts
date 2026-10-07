import { describe, expect, it } from 'vitest';
import { homeFor, resolveRedirect, type SessionSnapshot } from './routing';

const loading: SessionSnapshot = { status: 'loading' };
const signedOut: SessionSnapshot = { status: 'signedOut' };
const builder: SessionSnapshot = { status: 'signedIn', role: 'BUILDER' };
const supplier: SessionSnapshot = {
  status: 'signedIn',
  role: 'SUPPLIER',
  supplierProfile: 'present',
};
const newSupplier: SessionSnapshot = {
  status: 'signedIn',
  role: 'SUPPLIER',
  supplierProfile: 'missing',
};
const admin: SessionSnapshot = { status: 'signedIn', role: 'ADMIN' };

describe('resolveRedirect', () => {
  it.each([
    ['loading', loading, ['supplier'], null],

    ['signed out on root', signedOut, [], '/sign-in'],
    ['signed out on a builder page', signedOut, ['(builder)', 'home'], '/sign-in'],
    ['signed out on a supplier page', signedOut, ['supplier', 'fleet'], '/sign-in'],
    ['signed out on onboarding', signedOut, ['onboarding'], '/sign-in'],
    ['signed out on sign-in', signedOut, ['sign-in'], null],
    ['signed out on register', signedOut, ['register'], null],

    ['builder on root', builder, [], '/home'],
    ['builder on sign-in', builder, ['sign-in'], '/home'],
    ['builder on register', builder, ['register'], '/home'],
    ['builder on own home', builder, ['(builder)', 'home'], null],
    ['builder on a shared page', builder, ['equipment'], null],
    ['builder in supplier area', builder, ['supplier', 'fleet'], '/home'],
    ['builder on onboarding', builder, ['onboarding'], '/home'],

    ['supplier on root', supplier, [], '/supplier'],
    ['supplier on sign-in', supplier, ['sign-in'], '/supplier'],
    ['supplier on own home', supplier, ['supplier'], null],
    ['supplier on fleet', supplier, ['supplier', 'fleet'], null],
    ['supplier in builder area', supplier, ['(builder)', 'home'], '/supplier'],
    ['onboarded supplier on onboarding', supplier, ['onboarding'], '/supplier'],

    ['new supplier on root', newSupplier, [], '/onboarding'],
    ['new supplier in supplier area', newSupplier, ['supplier', 'pipeline'], '/onboarding'],
    ['new supplier on sign-in', newSupplier, ['sign-in'], '/onboarding'],
    ['new supplier on onboarding', newSupplier, ['onboarding'], null],

    ['admin anywhere', admin, ['(builder)', 'home'], '/sign-in'],
  ] as const)('%s', (_name, session, segments, expected) => {
    expect(resolveRedirect(session, segments)).toBe(expected);
  });

  it('never redirects a user away from their own home (no loops)', () => {
    expect(resolveRedirect(builder, ['(builder)', 'home'])).toBeNull();
    expect(resolveRedirect(supplier, ['supplier'])).toBeNull();
    expect(resolveRedirect(newSupplier, ['onboarding'])).toBeNull();
    expect(resolveRedirect(signedOut, ['sign-in'])).toBeNull();
  });
});

describe('homeFor', () => {
  it('maps each role to its area', () => {
    expect(homeFor('BUILDER')).toBe('/home');
    expect(homeFor('SUPPLIER')).toBe('/supplier');
    expect(homeFor('ADMIN')).toBeNull();
  });
});
