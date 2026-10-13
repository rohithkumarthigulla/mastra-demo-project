/** Kept free of react-native imports so it runs under vitest. */

/** Text for the bell's unread badge; empty when there is nothing unread. */
export function unreadBadgeText(unread: number): string {
  if (!Number.isFinite(unread) || unread < 1) return '';
  return unread > 99 ? '99+' : String(Math.floor(unread));
}

export function bellAccessibilityLabel(unread: number): string {
  const text = unreadBadgeText(unread);
  return text ? `Notifications, ${text} unread` : 'Notifications';
}
