import { describe, expect, it } from 'vitest';
import { passwordToggleLabels } from './passwordToggle';

describe('passwordToggleLabels', () => {
  it('offers to show the password while it is masked', () => {
    expect(passwordToggleLabels(false)).toEqual({
      title: 'Show',
      accessibilityLabel: 'Show password',
    });
  });

  it('offers to hide the password while it is visible', () => {
    expect(passwordToggleLabels(true)).toEqual({
      title: 'Hide',
      accessibilityLabel: 'Hide password',
    });
  });
});
