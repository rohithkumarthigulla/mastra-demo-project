export function passwordToggleLabels(visible: boolean) {
  return visible
    ? { title: 'Hide', accessibilityLabel: 'Hide password' }
    : { title: 'Show', accessibilityLabel: 'Show password' };
}
