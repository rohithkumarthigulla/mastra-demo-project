import { describe, expect, it } from 'vitest';
import { bellAccessibilityLabel, unreadBadgeText } from './badge';

describe('unreadBadgeText', () => {
  it.each([
    [0, ''],
    [-1, ''],
    [Number.NaN, ''],
    [1, '1'],
    [42, '42'],
    [99, '99'],
    [100, '99+'],
    [5000, '99+'],
  ])('%s → %j', (count, text) => {
    expect(unreadBadgeText(count)).toBe(text);
  });
});

describe('bellAccessibilityLabel', () => {
  it('names the count when there is one', () => {
    expect(bellAccessibilityLabel(3)).toBe('Notifications, 3 unread');
    expect(bellAccessibilityLabel(250)).toBe('Notifications, 99+ unread');
  });

  it('is plain when nothing is unread', () => {
    expect(bellAccessibilityLabel(0)).toBe('Notifications');
  });
});
